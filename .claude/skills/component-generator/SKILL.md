# Component Generator Skill

## Purpose
Quickly generate reusable UI components for your expense tracker with consistent styling and functionality.

## When to Activate
- User says: "create component", "add a", "build a", "generate"
- Component requests: "modal", "card", "button", "form", "chart", "dropdown", "toast"

## What This Skill Does

Generates ready-to-use components:
- Expense cards
- Modal dialogs
- Form fields
- Dropdown menus
- Charts (bar, pie, line)
- Toast notifications
- Loading states
- Empty states
- Category badges
- Date pickers

## Component Templates

### 1. Modal Dialog
```html
<div class="modal" id="expenseModal">
    <div class="modal-backdrop" onclick="closeModal()"></div>
    <div class="modal-content glass-card">
        <div class="modal-header">
            <h3>{{title}}</h3>
            <button class="btn-close" onclick="closeModal()">×</button>
        </div>
        <div class="modal-body">
            {{content}}
        </div>
        <div class="modal-footer">
            <button class="btn-secondary" onclick="closeModal()">Cancel</button>
            <button class="btn-primary" onclick="{{action}}">Save</button>
        </div>
    </div>
</div>

<style>
.modal {
    position: fixed;
    inset: 0;
    z-index: 1000;
    display: none;
    align-items: center;
    justify-content: center;
}

.modal.active { display: flex; }

.modal-backdrop {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(4px);
}

.modal-content {
    position: relative;
    max-width: 500px;
    width: 90%;
    max-height: 90vh;
    overflow-y: auto;
    animation: modalSlideIn 0.3s ease;
}

@keyframes modalSlideIn {
    from {
        opacity: 0;
        transform: translateY(-50px);
    }
}
</style>
```

### 2. Toast Notification
```javascript
function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
        <div class="toast-icon">${type === 'success' ? '✓' : '✗'}</div>
        <div class="toast-message">${message}</div>
    `;

    document.body.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('show');
    }, 10);

    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}
```

### 3. Expense Card Component
```javascript
function createExpenseCard(expense) {
    return `
        <div class="expense-card glass-card" data-id="${expense.id}">
            <div class="expense-header">
                <span class="category-badge" style="--category-color: ${getCategoryColor(expense.category)}">
                    ${getCategoryIcon(expense.category)} ${expense.category}
                </span>
                <span class="expense-amount">₹${expense.amount.toFixed(2)}</span>
            </div>
            <div class="expense-body">
                <h4>${expense.description}</h4>
                <div class="expense-meta">
                    <span>📅 ${formatDate(expense.date)}</span>
                    ${expense.vendor ? `<span>🏪 ${expense.vendor}</span>` : ''}
                </div>
            </div>
            <div class="expense-actions">
                <button class="btn-icon" onclick="editExpense('${expense.id}')">✏️</button>
                <button class="btn-icon" onclick="deleteExpense('${expense.id}')">🗑️</button>
                ${expense.receiptUrl ? `<button class="btn-icon" onclick="viewReceipt('${expense.id}')">🖼️</button>` : ''}
            </div>
        </div>
    `;
}
```

### 4. Chart Component (Chart.js)
```javascript
function createExpenseChart(expenses, type = 'doughnut') {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    const categoryData = groupByCategory(expenses);

    new Chart(ctx, {
        type: type,
        data: {
            labels: Object.keys(categoryData),
            datasets: [{
                data: Object.values(categoryData),
                backgroundColor: Object.keys(categoryData).map(cat => getCategoryColor(cat))
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { position: 'bottom' },
                title: { display: true, text: 'Expenses by Category' }
            }
        }
    });

    return canvas;
}
```

### 5. Loading Skeleton
```html
<div class="skeleton-card">
    <div class="skeleton skeleton-title"></div>
    <div class="skeleton skeleton-text"></div>
    <div class="skeleton skeleton-text short"></div>
</div>

<style>
.skeleton {
    background: linear-gradient(90deg,
        rgba(255,255,255,0.05) 25%,
        rgba(255,255,255,0.1) 50%,
        rgba(255,255,255,0.05) 75%
    );
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
    border-radius: 8px;
}

.skeleton-title { height: 24px; width: 60%; margin-bottom: 12px; }
.skeleton-text { height: 16px; width: 100%; margin-bottom: 8px; }
.skeleton-text.short { width: 70%; }
</style>
```

## Usage Examples

### Create a Modal
```
You: "Create a modal for editing expenses"
Claude: [Generates complete modal with form fields]
```

### Create a Chart
```
You: "Add a pie chart showing category breakdown"
Claude: [Generates Chart.js code with your data]
```

### Create a Toast
```
You: "Add toast notifications for success/error"
Claude: [Generates toast system with animations]
```

## Component Checklist

When generating components, ensure:
- [ ] Consistent styling with existing design
- [ ] Responsive (mobile-friendly)
- [ ] Accessible (keyboard navigation, ARIA labels)
- [ ] Animated (smooth transitions)
- [ ] Reusable (parameterized)
- [ ] Documented (clear usage examples)
