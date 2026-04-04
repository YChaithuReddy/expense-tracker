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

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    // Default to expenses section
    switchSection('expenses', document.querySelector('[data-section="expenses"]'));
});
