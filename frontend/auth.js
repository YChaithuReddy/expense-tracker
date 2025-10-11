/**
 * Authentication Logic for Expense Tracker
 * Handles user authentication state and protected routes
 */

// Check if user is authenticated
function isAuthenticated() {
    const token = localStorage.getItem('authToken');
    const user = localStorage.getItem('user');
    return !!(token && user);
}

// Get current user from localStorage
function getCurrentUser() {
    const userStr = localStorage.getItem('user');
    if (userStr) {
        try {
            return JSON.parse(userStr);
        } catch (error) {
            console.error('Error parsing user data:', error);
            return null;
        }
    }
    return null;
}

// Logout user
function logout() {
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    window.location.href = 'login.html';
}

// Protect a page (redirect to login if not authenticated)
function requireAuth() {
    if (!isAuthenticated()) {
        window.location.href = 'login.html';
        return false;
    }
    return true;
}

// Show user info in UI
function displayUserInfo() {
    const user = getCurrentUser();
    if (user) {
        // Find user info element if it exists
        const userInfoEl = document.getElementById('userInfo');
        if (userInfoEl) {
            userInfoEl.innerHTML = `
                <div style="text-align: center; width: 100%;">
                    <div style="color: var(--neon-cyan); font-weight: 600; font-size: 1.1rem; margin-bottom: 5px;">${user.name}</div>
                    <div style="color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 15px;">${user.email}</div>
                    <button onclick="logout()" class="btn-secondary" style="padding: 8px 16px; width: 100%; max-width: 200px;">🚪 Logout</button>
                </div>
            `;
        }
    }
}

// Initialize auth on page load
document.addEventListener('DOMContentLoaded', () => {
    // Check if current page requires authentication
    const currentPage = window.location.pathname.split('/').pop();

    // Pages that don't require auth
    const publicPages = ['login.html', 'signup.html'];

    if (!publicPages.includes(currentPage) && currentPage !== '') {
        // This is a protected page
        if (requireAuth()) {
            displayUserInfo();
        }
    }
});

// Export functions for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        isAuthenticated,
        getCurrentUser,
        logout,
        requireAuth,
        displayUserInfo
    };
}
