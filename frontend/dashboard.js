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

// Time-of-day greeting
function updateExpenseGreeting() {
    const greetingEl = document.getElementById('expenseGreeting');
    if (!greetingEl) return;
    const nameEl = document.getElementById('sidebarUserName');
    const name = (nameEl && nameEl.textContent.trim() && nameEl.textContent.trim() !== 'User')
        ? ', ' + nameEl.textContent.split(' ')[0]
        : '';
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
