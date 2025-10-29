# Feature Upgrader Skill

## Purpose
Add new features and upgrade existing functionality in your expense tracker with best practices and modern patterns.

## When to Activate
- User says: "add feature", "implement", "upgrade", "add support for"
- Requests: "dark mode", "budget tracking", "recurring expenses", "analytics"

## Feature Library

### 1. Dark Mode
```javascript
// Dark Mode Toggle
function initDarkMode() {
    const darkModeToggle = document.getElementById('darkModeToggle');
    const currentTheme = localStorage.getItem('theme') || 'light';

    document.documentElement.setAttribute('data-theme', currentTheme);

    darkModeToggle.addEventListener('click', () => {
        const theme = document.documentElement.getAttribute('data-theme');
        const newTheme = theme === 'light' ? 'dark' : 'light';

        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
    });
}

// CSS Variables for themes
:root[data-theme="light"] {
    --bg-primary: #ffffff;
    --text-primary: #1a1a1a;
}

:root[data-theme="dark"] {
    --bg-primary: #0f0f23;
    --text-primary: #ffffff;
}
```

### 2. Budget Tracking
```javascript
class BudgetTracker {
    constructor(monthlyBudget) {
        this.budget = monthlyBudget;
    }

    getCurrentSpending(expenses) {
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

        return expenses
            .filter(exp => new Date(exp.date) >= monthStart)
            .reduce((sum, exp) => sum + exp.amount, 0);
    }

    getRemainingBudget(expenses) {
        return this.budget - this.getCurrentSpending(expenses);
    }

    getWarningLevel(expenses) {
        const remaining = this.getRemainingBudget(expenses);
        const percentage = (remaining / this.budget) * 100;

        if (percentage < 10) return 'critical';
        if (percentage < 25) return 'warning';
        return 'safe';
    }

    shouldAlert(expenses) {
        return this.getWarningLevel(expenses) !== 'safe';
    }
}

// Usage
const budget = new BudgetTracker(50000);
const spent = budget.getCurrentSpending(expenses);
const remaining = budget.getRemainingBudget(expenses);

if (budget.shouldAlert(expenses)) {
    showNotification(`Budget Alert: Only ₹${remaining} remaining!`, 'warning');
}
```

### 3. Recurring Expenses
```javascript
class RecurringExpense {
    constructor(expense, frequency) {
        this.expense = expense;
        this.frequency = frequency; // 'daily', 'weekly', 'monthly'
        this.lastAdded = new Date(expense.date);
    }

    shouldAdd() {
        const now = new Date();
        const diff = now - this.lastAdded;

        switch (this.frequency) {
            case 'daily':
                return diff >= 24 * 60 * 60 * 1000;
            case 'weekly':
                return diff >= 7 * 24 * 60 * 60 * 1000;
            case 'monthly':
                return now.getMonth() !== this.lastAdded.getMonth();
            default:
                return false;
        }
    }

    async addIfDue() {
        if (this.shouldAdd()) {
            const newExpense = {
                ...this.expense,
                date: new Date().toISOString().split('T')[0],
                recurring: true
            };

            await api.addExpense(newExpense);
            this.lastAdded = new Date();
            return true;
        }
        return false;
    }
}

// Check recurring expenses daily
setInterval(checkRecurringExpenses, 24 * 60 * 60 * 1000);
```

### 4. Smart Category Suggestions
```javascript
function suggestCategory(description) {
    const keywords = {
        'Transportation': ['uber', 'ola', 'cab', 'taxi', 'petrol', 'fuel'],
        'Meals': ['food', 'restaurant', 'swiggy', 'zomato', 'lunch', 'dinner'],
        'Shopping': ['amazon', 'flipkart', 'shopping', 'purchase'],
        'Bills': ['electricity', 'water', 'internet', 'phone'],
        'Entertainment': ['movie', 'netflix', 'concert']
    };

    const lowerDesc = description.toLowerCase();

    for (const [category, words] of Object.entries(keywords)) {
        if (words.some(word => lowerDesc.includes(word))) {
            return category;
        }
    }

    return 'Miscellaneous';
}

// Auto-fill category on description change
descriptionInput.addEventListener('input', (e) => {
    const suggested = suggestCategory(e.target.value);
    categorySelect.value = suggested;
});
```

### 5. Export to Google Sheets
```javascript
async function exportToGoogleSheets(expenses) {
    const spreadsheetId = 'YOUR_SHEET_ID';
    const range = 'Sheet1!A1';

    const values = expenses.map(exp => [
        exp.date,
        exp.category,
        exp.description,
        exp.amount,
        exp.vendor || ''
    ]);

    const response = await gapi.client.sheets.spreadsheets.values.update({
        spreadsheetId,
        range,
        valueInputOption: 'RAW',
        resource: { values }
    });

    return response;
}
```

### 6. Receipt OCR Auto-Fill
```javascript
async function autoFillFromReceipt(imageFile) {
    // Use OCR skill
    const ocr = new IndianReceiptOCR();
    const result = await Tesseract.recognize(imageFile);
    const enhanced = await ocr.enhance(result.data.text);

    // Auto-fill form
    document.getElementById('amount').value = enhanced.amount;
    document.getElementById('date').value = enhanced.date;
    document.getElementById('category').value = enhanced.category;
    document.getElementById('description').value = enhanced.vendor.name;

    // Show confidence
    showMessage(`Auto-filled with ${enhanced.confidence}% confidence`, 'success');
}
```

### 7. Duplicate Detection
```javascript
function detectDuplicateExpense(newExpense, existingExpenses) {
    const threshold = 0.9; // 90% similarity

    for (const existing of existingExpenses) {
        const similarity = calculateSimilarity(newExpense, existing);

        if (similarity > threshold) {
            return {
                isDuplicate: true,
                matchedExpense: existing,
                similarity: (similarity * 100).toFixed(0)
            };
        }
    }

    return { isDuplicate: false };
}

function calculateSimilarity(exp1, exp2) {
    let score = 0;

    // Same date
    if (exp1.date === exp2.date) score += 0.4;

    // Same amount (within ₹1)
    if (Math.abs(exp1.amount - exp2.amount) < 1) score += 0.3;

    // Same category
    if (exp1.category === exp2.category) score += 0.2;

    // Similar description
    const desc1 = exp1.description.toLowerCase();
    const desc2 = exp2.description.toLowerCase();
    if (desc1.includes(desc2) || desc2.includes(desc1)) score += 0.1;

    return score;
}
```

### 8. Multi-Currency Support
```javascript
class CurrencyConverter {
    constructor() {
        this.rates = {};
        this.baseCurrency = 'INR';
    }

    async updateRates() {
        const response = await fetch('https://api.exchangerate-api.com/v4/latest/INR');
        const data = await response.json();
        this.rates = data.rates;
    }

    convert(amount, from, to) {
        if (from === to) return amount;

        // Convert to base currency (INR)
        const inINR = from === this.baseCurrency ? amount : amount / this.rates[from];

        // Convert to target currency
        return to === this.baseCurrency ? inINR : inINR * this.rates[to];
    }
}
```

## Feature Request Template

When user requests a feature:
1. Understand the requirement
2. Check if skill exists
3. Implement with best practices
4. Add proper error handling
5. Make it mobile-responsive
6. Add user feedback (loading, success, error)
7. Test thoroughly

## Quick Feature Additions

```
You: "Add dark mode"
Claude: [Implements complete dark mode with toggle]

You: "Add budget tracking"
Claude: [Adds budget limits with warnings]

You: "Detect duplicate expenses"
Claude: [Implements smart duplicate detection]
```
