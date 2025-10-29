# Performance Optimizer Skill

## Purpose
Make your expense tracker load faster and run smoother through code optimization, lazy loading, and caching strategies.

## When to Activate
- User says: "slow", "performance", "optimize", "speed up", "lag", "loading time"
- Issues: "images take long", "app freezes", "high memory usage"

## Optimization Strategies

### 1. Image Lazy Loading
```javascript
// Lazy load receipt images
function lazyLoadImages() {
    const images = document.querySelectorAll('img[data-src]');

    const imageObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                img.src = img.dataset.src;
                img.removeAttribute('data-src');
                imageObserver.unobserve(img);
            }
        });
    });

    images.forEach(img => imageObserver.observe(img));
}
```

### 2. Debounce Search/Filter
```javascript
function debounce(func, wait) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

// Use on search input
searchInput.addEventListener('input', debounce(function(e) {
    filterExpenses(e.target.value);
}, 300));
```

### 3. Virtual Scrolling for Large Lists
```javascript
class VirtualScroller {
    constructor(container, itemHeight, renderItem) {
        this.container = container;
        this.itemHeight = itemHeight;
        this.renderItem = renderItem;
        this.visibleItems = Math.ceil(container.clientHeight / itemHeight) + 2;
    }

    render(data) {
        const scrollTop = this.container.scrollTop;
        const startIndex = Math.floor(scrollTop / this.itemHeight);
        const endIndex = Math.min(startIndex + this.visibleItems, data.length);

        this.container.innerHTML = '';
        for (let i = startIndex; i < endIndex; i++) {
            const item = this.renderItem(data[i]);
            item.style.transform = `translateY(${i * this.itemHeight}px)`;
            this.container.appendChild(item);
        }
    }
}
```

### 4. IndexedDB for Offline Storage
```javascript
// Cache expenses locally
const DB_NAME = 'ExpenseTrackerDB';
const DB_VERSION = 1;

function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains('expenses')) {
                db.createObjectStore('expenses', { keyPath: 'id' });
            }
        };
    });
}

async function cacheExpenses(expenses) {
    const db = await initDB();
    const tx = db.transaction('expenses', 'readwrite');
    const store = tx.objectStore('expenses');

    expenses.forEach(expense => store.put(expense));
    await tx.complete;
}
```

### 5. Code Splitting
```javascript
// Lazy load Chart.js only when needed
async function loadChartLibrary() {
    if (!window.Chart) {
        await import('https://cdn.jsdelivr.net/npm/chart.js');
    }
    return window.Chart;
}

// Use when showing charts
async function showCharts() {
    const Chart = await loadChartLibrary();
    // Now use Chart.js
}
```

### 6. Request Caching
```javascript
class APICache {
    constructor(ttl = 5 * 60 * 1000) {
        this.cache = new Map();
        this.ttl = ttl;
    }

    set(key, value) {
        this.cache.set(key, {
            value,
            timestamp: Date.now()
        });
    }

    get(key) {
        const item = this.cache.get(key);
        if (!item) return null;

        if (Date.now() - item.timestamp > this.ttl) {
            this.cache.delete(key);
            return null;
        }

        return item.value;
    }
}

const apiCache = new APICache();

async function fetchExpensesWithCache() {
    const cached = apiCache.get('expenses');
    if (cached) return cached;

    const data = await api.getExpenses();
    apiCache.set('expenses', data);
    return data;
}
```

## Performance Checklist

- [ ] Lazy load images
- [ ] Debounce search/filter inputs
- [ ] Virtual scrolling for 100+ items
- [ ] Cache API responses
- [ ] Minimize DOM manipulations
- [ ] Use CSS transforms instead of layout changes
- [ ] Compress images before upload
- [ ] Remove unused code
- [ ] Minify CSS/JS for production
- [ ] Use CDN for libraries

## Expected Improvements

- Initial load: 3s → 1s (67% faster)
- Image loading: Lazy (only when visible)
- Search/filter: No lag
- Large lists: Smooth scrolling
- Offline: Works with cached data
