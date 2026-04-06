// Dashboard Navigation Controller — matches admin.html pattern exactly
function switchSection(section, btn) {
    // Hide all sections
    document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
    // Deactivate all nav items
    document.querySelectorAll('.admin-nav-item').forEach(n => n.classList.remove('active'));
    // Show the target section
    const el = document.getElementById('section-' + section);
    if (el) el.classList.add('active');
    // Mark the nav button as active
    if (btn) btn.classList.add('active');

    // When switching to history, update stats and trigger expense load
    if (section === 'history') {
        updateHistoryStats();
        if (window.expenseTracker && typeof expenseTracker.loadExpenses === 'function') {
            expenseTracker.loadExpenses();
        }
    }

    // When switching to reports, load expenses first then render
    if (section === 'reports') {
        if (window.expenseTracker) {
            if (expenseTracker.expenses?.length > 0) {
                expenseTracker.renderReports();
            } else if (typeof expenseTracker.loadExpenses === 'function') {
                expenseTracker.loadExpenses().then(() => expenseTracker.renderReports());
            }
        }
    }
}

// Update history stats from loaded expenses
function updateHistoryStats() {
    try {
        const totalEl = document.getElementById('histStatTotal');
        const amountEl = document.getElementById('histStatAmount');
        const monthEl = document.getElementById('histStatMonth');
        if (!totalEl) return;

        // Try to get expense data from expenseTracker
        const expenses = (window.expenseTracker && expenseTracker.expenses) || [];
        const total = expenses.length;
        const totalAmt = expenses.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);

        // This month count
        const now = new Date();
        const thisMonth = expenses.filter(e => {
            const d = new Date(e.date || e.created_at);
            return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        }).length;

        totalEl.textContent = total;
        amountEl.textContent = '₹' + totalAmt.toLocaleString('en-IN');
        monthEl.textContent = thisMonth;
    } catch(e) { /* ignore */ }
}

// ---- Premium sidebar helpers ----

// Update avatar initials whenever sidebarUserName changes
function updateSidebarAvatar() {
    const nameEl = document.getElementById('sidebarUserName');
    const avatarEl = document.getElementById('sidebarAvatar');
    if (!avatarEl) return;
    const name = (nameEl && nameEl.textContent.trim()) || '';
    if (name && name !== 'User') {
        const parts = name.split(' ').filter(Boolean);
        const initials = parts.length >= 2
            ? parts[0][0].toUpperCase() + parts[parts.length - 1][0].toUpperCase()
            : parts[0] ? parts[0][0].toUpperCase() : 'U';
        avatarEl.textContent = initials;
    }
}

// Time-of-day greeting — pulls name from sidebar OR localStorage
function updateExpenseGreeting() {
    const greetingEl = document.getElementById('expenseGreeting');
    if (!greetingEl) return;
    // Try sidebar first, fall back to localStorage
    const nameEl = document.getElementById('sidebarUserName');
    let userName = (nameEl && nameEl.textContent.trim() && nameEl.textContent.trim() !== 'User')
        ? nameEl.textContent.split(' ')[0]
        : '';
    if (!userName) {
        try {
            const stored = JSON.parse(localStorage.getItem('user') || '{}');
            userName = stored.name ? stored.name.split(' ')[0] : '';
        } catch(e) {}
    }
    const name = userName ? ', ' + userName : '';
    const hour = new Date().getHours();
    let tod;
    if (hour < 12) tod = 'Good morning';
    else if (hour < 17) tod = 'Good afternoon';
    else tod = 'Good evening';
    greetingEl.textContent = tod + name;
}

// ---- Initialize on DOM ready ----
document.addEventListener('DOMContentLoaded', () => {
    // Default to expenses section
    switchSection('expenses', document.querySelector('[data-section="expenses"]'));

    // Initial greeting
    updateExpenseGreeting();

    // Watch for JS-populated username changes (MutationObserver)
    const nameEl = document.getElementById('sidebarUserName');
    if (nameEl) {
        const obs = new MutationObserver(() => {
            updateSidebarAvatar();
            updateExpenseGreeting();
        });
        obs.observe(nameEl, { childList: true, subtree: true, characterData: true });
    }
});
