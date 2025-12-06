/**
 * Offline Manager for Expense Tracker PWA
 * Handles offline expense storage, sync, and network status
 */

class OfflineManager {
    constructor() {
        this.dbName = 'ExpenseTrackerOffline';
        this.dbVersion = 1;
        this.db = null;
        this.isOnline = navigator.onLine;
        this.syncInProgress = false;
        this.retryQueue = [];

        this.init();
    }

    async init() {
        // Open IndexedDB
        await this.openDatabase();

        // Listen for online/offline events
        window.addEventListener('online', () => this.handleOnline());
        window.addEventListener('offline', () => this.handleOffline());

        // Create network status indicator
        this.createNetworkIndicator();

        // Initial status check
        this.updateNetworkStatus();

        // Try to sync any pending expenses on load
        if (this.isOnline) {
            setTimeout(() => this.syncPendingExpenses(), 2000);
        }

        console.log('📴 Offline Manager initialized');
    }

    // ==================== IndexedDB ====================

    openDatabase() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onerror = () => {
                console.error('Failed to open IndexedDB:', request.error);
                reject(request.error);
            };

            request.onsuccess = () => {
                this.db = request.result;
                console.log('✅ IndexedDB opened');
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // Store for pending expenses (to be synced when online)
                if (!db.objectStoreNames.contains('pendingExpenses')) {
                    const store = db.createObjectStore('pendingExpenses', {
                        keyPath: 'id',
                        autoIncrement: true
                    });
                    store.createIndex('timestamp', 'timestamp', { unique: false });
                }

                // Store for cached expenses (for offline viewing)
                if (!db.objectStoreNames.contains('cachedExpenses')) {
                    const store = db.createObjectStore('cachedExpenses', {
                        keyPath: '_id'
                    });
                    store.createIndex('date', 'date', { unique: false });
                }

                // Store for failed requests (retry queue)
                if (!db.objectStoreNames.contains('failedRequests')) {
                    db.createObjectStore('failedRequests', {
                        keyPath: 'id',
                        autoIncrement: true
                    });
                }

                console.log('✅ IndexedDB schema created');
            };
        });
    }

    // ==================== Pending Expenses ====================

    async savePendingExpense(expenseData) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('Database not initialized'));
                return;
            }

            const transaction = this.db.transaction(['pendingExpenses'], 'readwrite');
            const store = transaction.objectStore('pendingExpenses');

            const pendingExpense = {
                data: expenseData,
                timestamp: Date.now(),
                token: localStorage.getItem('token'),
                attempts: 0
            };

            const request = store.add(pendingExpense);

            request.onsuccess = () => {
                console.log('💾 Expense saved for offline sync:', request.result);
                this.showNotification('Expense saved offline. Will sync when online.', 'warning');
                this.updatePendingBadge();
                resolve(request.result);
            };

            request.onerror = () => {
                console.error('Failed to save pending expense:', request.error);
                reject(request.error);
            };
        });
    }

    async getPendingExpenses() {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                resolve([]);
                return;
            }

            const transaction = this.db.transaction(['pendingExpenses'], 'readonly');
            const store = transaction.objectStore('pendingExpenses');
            const request = store.getAll();

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async deletePendingExpense(id) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('Database not initialized'));
                return;
            }

            const transaction = this.db.transaction(['pendingExpenses'], 'readwrite');
            const store = transaction.objectStore('pendingExpenses');
            const request = store.delete(id);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async getPendingCount() {
        const pending = await this.getPendingExpenses();
        return pending.length;
    }

    // ==================== Sync Logic ====================

    async syncPendingExpenses() {
        if (this.syncInProgress || !this.isOnline) {
            return;
        }

        const pending = await this.getPendingExpenses();
        if (pending.length === 0) {
            return;
        }

        this.syncInProgress = true;
        console.log(`🔄 Syncing ${pending.length} pending expenses...`);
        this.showNotification(`Syncing ${pending.length} offline expense(s)...`, 'info');

        let successCount = 0;
        let failCount = 0;

        for (const item of pending) {
            try {
                const response = await fetch(`${window.API_BASE_URL || ''}/api/expenses`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${item.token}`
                    },
                    body: JSON.stringify(item.data)
                });

                if (response.ok) {
                    await this.deletePendingExpense(item.id);
                    successCount++;
                    console.log(`✅ Synced expense ${item.id}`);
                } else if (response.status === 401) {
                    // Token expired, can't sync
                    console.warn('Token expired, cannot sync expense');
                    failCount++;
                } else {
                    // Other error, increment attempts
                    item.attempts++;
                    if (item.attempts >= 3) {
                        // Too many attempts, delete it
                        await this.deletePendingExpense(item.id);
                        failCount++;
                    }
                }
            } catch (error) {
                console.error('Sync error for expense:', item.id, error);
                failCount++;
            }
        }

        this.syncInProgress = false;
        this.updatePendingBadge();

        if (successCount > 0) {
            this.showNotification(`✅ Synced ${successCount} expense(s)`, 'success');
            // Refresh the expenses list
            if (window.expenseTracker && typeof window.expenseTracker.loadExpenses === 'function') {
                window.expenseTracker.loadExpenses();
            }
        }

        if (failCount > 0) {
            this.showNotification(`⚠️ ${failCount} expense(s) failed to sync`, 'error');
        }
    }

    // ==================== Cache Expenses ====================

    async cacheExpenses(expenses) {
        if (!this.db || !expenses || !Array.isArray(expenses)) return;

        const transaction = this.db.transaction(['cachedExpenses'], 'readwrite');
        const store = transaction.objectStore('cachedExpenses');

        // Clear old cache
        store.clear();

        // Add new expenses
        for (const expense of expenses) {
            store.put(expense);
        }

        console.log(`💾 Cached ${expenses.length} expenses for offline viewing`);
    }

    async getCachedExpenses() {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                resolve([]);
                return;
            }

            const transaction = this.db.transaction(['cachedExpenses'], 'readonly');
            const store = transaction.objectStore('cachedExpenses');
            const request = store.getAll();

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    // ==================== Network Status ====================

    handleOnline() {
        this.isOnline = true;
        this.updateNetworkStatus();
        console.log('🌐 Back online');
        this.showNotification('You are back online!', 'success');

        // Sync pending expenses
        setTimeout(() => this.syncPendingExpenses(), 1000);
    }

    handleOffline() {
        this.isOnline = false;
        this.updateNetworkStatus();
        console.log('📴 Gone offline');
        this.showNotification('You are offline. Changes will be saved locally.', 'warning');
    }

    updateNetworkStatus() {
        const indicator = document.getElementById('network-status-indicator');
        if (!indicator) return;

        if (this.isOnline) {
            indicator.classList.remove('offline');
            indicator.classList.add('online');
            indicator.innerHTML = '<span class="status-dot"></span><span class="status-text">Online</span>';
        } else {
            indicator.classList.remove('online');
            indicator.classList.add('offline');
            indicator.innerHTML = '<span class="status-dot"></span><span class="status-text">Offline</span>';
        }
    }

    createNetworkIndicator() {
        // Check if already exists
        if (document.getElementById('network-status-indicator')) return;

        const indicator = document.createElement('div');
        indicator.id = 'network-status-indicator';
        indicator.className = this.isOnline ? 'online' : 'offline';
        indicator.innerHTML = `
            <span class="status-dot"></span>
            <span class="status-text">${this.isOnline ? 'Online' : 'Offline'}</span>
        `;

        // Add styles
        const styles = document.createElement('style');
        styles.textContent = `
            #network-status-indicator {
                position: fixed;
                bottom: 20px;
                right: 20px;
                padding: 8px 16px;
                border-radius: 20px;
                display: flex;
                align-items: center;
                gap: 8px;
                font-size: 12px;
                font-weight: 600;
                z-index: 9999;
                transition: all 0.3s ease;
                box-shadow: 0 2px 10px rgba(0,0,0,0.2);
            }

            #network-status-indicator.online {
                background: linear-gradient(135deg, #10b981, #059669);
                color: white;
                opacity: 0;
                pointer-events: none;
            }

            #network-status-indicator.offline {
                background: linear-gradient(135deg, #f59e0b, #d97706);
                color: white;
                opacity: 1;
            }

            #network-status-indicator .status-dot {
                width: 8px;
                height: 8px;
                border-radius: 50%;
                background: currentColor;
                animation: pulse 2s infinite;
            }

            #network-status-indicator.offline .status-dot {
                animation: none;
            }

            @keyframes pulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.5; }
            }

            #pending-sync-badge {
                position: fixed;
                bottom: 70px;
                right: 20px;
                background: linear-gradient(135deg, #8b5cf6, #7c3aed);
                color: white;
                padding: 8px 16px;
                border-radius: 20px;
                font-size: 12px;
                font-weight: 600;
                z-index: 9999;
                display: none;
                box-shadow: 0 2px 10px rgba(0,0,0,0.2);
                cursor: pointer;
            }

            #pending-sync-badge:hover {
                transform: scale(1.05);
            }

            .offline-notification {
                position: fixed;
                top: 20px;
                left: 50%;
                transform: translateX(-50%);
                padding: 12px 24px;
                border-radius: 8px;
                font-size: 14px;
                font-weight: 500;
                z-index: 10000;
                animation: slideDown 0.3s ease;
                box-shadow: 0 4px 20px rgba(0,0,0,0.3);
            }

            .offline-notification.success {
                background: linear-gradient(135deg, #10b981, #059669);
                color: white;
            }

            .offline-notification.warning {
                background: linear-gradient(135deg, #f59e0b, #d97706);
                color: white;
            }

            .offline-notification.error {
                background: linear-gradient(135deg, #ef4444, #dc2626);
                color: white;
            }

            .offline-notification.info {
                background: linear-gradient(135deg, #3b82f6, #2563eb);
                color: white;
            }

            @keyframes slideDown {
                from {
                    opacity: 0;
                    transform: translateX(-50%) translateY(-20px);
                }
                to {
                    opacity: 1;
                    transform: translateX(-50%) translateY(0);
                }
            }
        `;

        document.head.appendChild(styles);
        document.body.appendChild(indicator);

        // Create pending sync badge
        const badge = document.createElement('div');
        badge.id = 'pending-sync-badge';
        badge.onclick = () => this.syncPendingExpenses();
        document.body.appendChild(badge);

        this.updatePendingBadge();
    }

    async updatePendingBadge() {
        const badge = document.getElementById('pending-sync-badge');
        if (!badge) return;

        const count = await this.getPendingCount();
        if (count > 0) {
            badge.textContent = `📤 ${count} pending expense${count > 1 ? 's' : ''} to sync`;
            badge.style.display = 'block';
        } else {
            badge.style.display = 'none';
        }
    }

    showNotification(message, type = 'info') {
        // Remove existing notifications
        const existing = document.querySelector('.offline-notification');
        if (existing) existing.remove();

        const notification = document.createElement('div');
        notification.className = `offline-notification ${type}`;
        notification.textContent = message;
        document.body.appendChild(notification);

        // Auto-remove after 3 seconds
        setTimeout(() => {
            notification.style.animation = 'slideDown 0.3s ease reverse';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    // ==================== API Wrapper with Retry ====================

    async fetchWithRetry(url, options = {}, retries = 3) {
        for (let i = 0; i < retries; i++) {
            try {
                if (!this.isOnline) {
                    throw new Error('No internet connection');
                }

                const response = await fetch(url, {
                    ...options,
                    headers: {
                        ...options.headers,
                        'Authorization': `Bearer ${localStorage.getItem('token')}`
                    }
                });

                if (!response.ok && response.status >= 500) {
                    throw new Error(`Server error: ${response.status}`);
                }

                return response;
            } catch (error) {
                console.warn(`Fetch attempt ${i + 1} failed:`, error.message);

                if (i === retries - 1) {
                    throw error;
                }

                // Wait before retrying (exponential backoff)
                await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
            }
        }
    }

    // ==================== Helper: Add expense with offline support ====================

    async addExpenseWithOfflineSupport(expenseData) {
        if (!this.isOnline) {
            // Save offline
            await this.savePendingExpense(expenseData);
            return { success: true, offline: true };
        }

        try {
            const response = await this.fetchWithRetry(
                `${window.API_BASE_URL || ''}/api/expenses`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(expenseData)
                }
            );

            if (response.ok) {
                const data = await response.json();
                return { success: true, data };
            } else {
                throw new Error('Failed to save expense');
            }
        } catch (error) {
            console.error('Failed to save expense online, saving offline:', error);
            await this.savePendingExpense(expenseData);
            return { success: true, offline: true };
        }
    }
}

// Initialize and export
const offlineManager = new OfflineManager();
window.offlineManager = offlineManager;

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = OfflineManager;
}
