// Service Worker for Expense Tracker PWA
const CACHE_NAME = 'expense-tracker-v102';
const STATIC_CACHE = 'expense-tracker-static-v83';
const DYNAMIC_CACHE = 'expense-tracker-dynamic-v83';

// Files to cache immediately on install
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/login.html',
  '/signup.html',
  '/admin.html',
  '/accountant.html',
  '/styles.css',
  '/styles_images.css',
  '/styles_dropdown.css',
  '/styles_clear_data.css',
  '/styles_saved_images.css',
  '/script.js',
  '/supabase-client.js',
  '/supabase-api.js',
  '/supabase-auth.js',
  '/google-sheets-service.js',
  '/kodo-service.js',
  '/whatsapp-service.js',
  '/offline-manager.js',
  '/toast.js',
  '/progress-modal.js',
  '/deep-link-handler.js',
  '/upi-import.js',
  '/pdfs.html',
  '/pdfs.js',
  '/activity-log.js',
  '/submit-wizard.js',
  '/expense-detail.js',
  '/admin-panel.js',
  '/project-dropdown.js',
  '/approval-workflow.js',
  '/notification-center.js',
  '/tally-export.js',
  '/realtime.js',
  '/dashboard.js',
  '/styles_dashboard.css',
  '/styles_pdfs.css',
  '/styles_admin.css',
  '/styles_projects.css',
  '/styles_approval.css',
  '/styles_notifications.css',
  '/favicon.svg',
  '/manifest.json',
  '/dashboard.html',
  '/css/index.css',
  '/css/design-system.css',
  '/css/layout.css',
  '/css/components.css',
  '/css/responsive.css',
  '/css/pages.css',
  '/js/navigation.js',
  '/js/ui-states.js',
  '/pages/add-expense.html',
  '/pages/expenses.html',
  '/pages/wallets.html',
  '/pages/summary.html',
  '/pages/accounts.html',
  '/pages/settings.html',
  // Essential CDN resources (needed for page load)
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
  'https://cdn.jsdelivr.net/npm/flatpickr/dist/flatpickr.min.css',
  'https://cdn.jsdelivr.net/npm/flatpickr'
  // Heavy export/OCR libraries are NOT pre-cached — they are lazy-loaded
  // and will be cached dynamically on first use:
  // xlsx.full.min.js, jspdf.umd.min.js, pdf-lib.min.js, tesseract.min.js
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing Service Worker...');

  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('[SW] Caching static assets');
        // Cache static assets one by one to handle failures gracefully
        return Promise.allSettled(
          STATIC_ASSETS.map(url =>
            cache.add(url).catch(err => {
              console.warn(`[SW] Failed to cache: ${url}`, err);
            })
          )
        );
      })
      .then(() => {
        console.log('[SW] Static assets cached');
        return self.skipWaiting(); // Activate immediately
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating Service Worker...');

  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name !== STATIC_CACHE && name !== DYNAMIC_CACHE && name !== CACHE_NAME)
            .map((name) => {
              console.log('[SW] Deleting old cache:', name);
              return caches.delete(name);
            })
        );
      })
      .then(() => {
        console.log('[SW] Service Worker activated');
        return self.clients.claim(); // Take control of all pages
      })
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-http(s) requests (e.g., chrome-extension://)
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip API calls - always go to network for fresh data
  if (url.pathname.startsWith('/api/') || url.hostname.includes('supabase.co') || url.hostname.includes('ocr.space') || url.hostname.includes('script.google.com')) {
    event.respondWith(
      fetch(request)
        .catch(() => {
          // Return offline response for API calls
          return new Response(
            JSON.stringify({
              success: false,
              message: 'You are offline. Please check your connection.',
              offline: true
            }),
            {
              status: 503,
              headers: { 'Content-Type': 'application/json' }
            }
          );
        })
    );
    return;
  }

  // For static assets - Network First strategy (always get fresh content)
  if (STATIC_ASSETS.some(asset => request.url.includes(asset) || url.pathname === asset)) {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse.ok) {
            const responseClone = networkResponse.clone();
            caches.open(STATIC_CACHE)
              .then((cache) => cache.put(request, responseClone));
          }
          return networkResponse;
        })
        .catch(() => {
          // Network failed, fall back to cache
          return caches.match(request);
        })
    );
    return;
  }

  // For other requests - Network First with cache fallback
  event.respondWith(
    fetch(request)
      .then((networkResponse) => {
        // Cache successful responses
        if (networkResponse.ok) {
          const responseClone = networkResponse.clone();
          caches.open(DYNAMIC_CACHE)
            .then((cache) => cache.put(request, responseClone));
        }
        return networkResponse;
      })
      .catch(() => {
        // Network failed, try cache
        return caches.match(request)
          .then((cachedResponse) => {
            if (cachedResponse) {
              return cachedResponse;
            }

            // If it's a page navigation, show offline page
            if (request.mode === 'navigate') {
              return caches.match('/index.html');
            }

            // Return offline response
            return new Response('Offline', { status: 503 });
          });
      })
  );
});

// Background sync for offline expense submissions
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync triggered:', event.tag);

  if (event.tag === 'sync-expenses') {
    event.waitUntil(syncPendingExpenses());
  }
});

// Sync pending expenses when back online
async function syncPendingExpenses() {
  try {
    const db = await openIndexedDB();
    const pendingExpenses = await getPendingExpenses(db);

    for (const expense of pendingExpenses) {
      try {
        const response = await fetch('/api/expenses', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${expense.token}`
          },
          body: JSON.stringify(expense.data)
        });

        if (response.ok) {
          await deletePendingExpense(db, expense.id);
          console.log('[SW] Synced expense:', expense.id);
        }
      } catch (err) {
        console.error('[SW] Failed to sync expense:', expense.id, err);
      }
    }
  } catch (err) {
    console.error('[SW] Sync failed:', err);
  }
}

// IndexedDB helpers for offline storage
function openIndexedDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('ExpenseTrackerOffline', 1);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('pendingExpenses')) {
        db.createObjectStore('pendingExpenses', { keyPath: 'id', autoIncrement: true });
      }
    };
  });
}

function getPendingExpenses(db) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['pendingExpenses'], 'readonly');
    const store = transaction.objectStore('pendingExpenses');
    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

function deletePendingExpense(db, id) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['pendingExpenses'], 'readwrite');
    const store = transaction.objectStore('pendingExpenses');
    const request = store.delete(id);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

// Push notifications (for future use)
self.addEventListener('push', (event) => {
  console.log('[SW] Push notification received');

  const options = {
    body: event.data ? event.data.text() : 'New notification',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      { action: 'view', title: 'View' },
      { action: 'close', title: 'Close' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification('Expense Tracker', options)
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked');
  event.notification.close();

  event.waitUntil(
    clients.openWindow('/')
  );
});

console.log('[SW] Service Worker loaded');
