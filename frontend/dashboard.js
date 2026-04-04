// Dashboard Manager - Handles section switching and dashboard interactions
const dashboardManager = {
    currentSection: 'dashboard',

    init() {
        this.setupNavigation();
        this.setupFAB();
        this.populateDashboard();
    },

    setupNavigation() {
        const navItems = document.querySelectorAll('.nav-item');
        navItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const section = item.getAttribute('data-section');
                this.switchSection(section);
            });
        });
    },

    switchSection(section) {
        // Hide all sections
        document.querySelectorAll('.dashboard-section').forEach(s => {
            s.classList.remove('is-active');
        });

        // Update nav active state
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('nav-item--active');
        });

        // Show selected section
        const sectionEl = document.getElementById(`${section}Section`);
        if (sectionEl) {
            sectionEl.classList.add('is-active');
        }

        // Update nav active state
        const navItem = document.querySelector(`[data-section="${section}"]`);
        if (navItem) {
            navItem.classList.add('nav-item--active');
        }

        this.currentSection = section;
    },

    setupFAB() {
        const fab = document.getElementById('fabAddExpense');
        if (fab) {
            fab.addEventListener('click', () => {
                this.switchSection('expenses');
                // Trigger the manual entry flow
                const skipBtn = document.getElementById('skipToManualEntry');
                if (skipBtn) {
                    skipBtn.click();
                }
            });
        }
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
