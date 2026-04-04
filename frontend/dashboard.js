// Dashboard Navigation Controller — matches admin.html pattern
const dashboardManager = {
    currentSection: 'overview',

    init() {
        this.setupNavigation();
        this.populateDashboard();
        this.setupUserInfo();
    },

    setupNavigation() {
        const navItems = document.querySelectorAll('.admin-nav-item');
        navItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const section = item.getAttribute('data-section');
                this.switchSection(section, item);
            });
        });
    },

    switchSection(section, btn) {
        // Hide all sections
        document.querySelectorAll('.admin-section').forEach(s => {
            s.classList.remove('active');
        });

        // Deactivate all nav items
        document.querySelectorAll('.admin-nav-item').forEach(item => {
            item.classList.remove('active');
        });

        // Show selected section
        const sectionEl = document.getElementById(`section-${section}`);
        if (sectionEl) {
            sectionEl.classList.add('active');
        }

        // Update nav active state
        if (btn) {
            btn.classList.add('active');
        } else {
            const navItem = document.querySelector(`[data-section="${section}"]`);
            if (navItem) {
                navItem.classList.add('active');
            }
        }

        this.currentSection = section;
    },

    setupUserInfo() {
        // Will be called after auth is initialized
        // to populate user name and email in sidebar
    },

    populateDashboard() {
        // This will be called after ExpenseTracker is initialized
        // to populate dashboard data from expenses
    }
};

// Initialize dashboard when page loads
document.addEventListener('DOMContentLoaded', () => {
    dashboardManager.init();
});
