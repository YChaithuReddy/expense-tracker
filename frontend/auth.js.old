/**
 * Authentication Logic for Expense Tracker
 * Handles user authentication state and protected routes
 */

// Sanitize HTML to prevent XSS attacks
function sanitizeHTML(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

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
            // Sanitize user data to prevent XSS
            const safeName = sanitizeHTML(user.name);
            const safeEmail = sanitizeHTML(user.email);

            userInfoEl.innerHTML = `
                <div class="user-info-content">
                    <div class="user-details">
                        <div class="user-name">${safeName}</div>
                        <div class="user-email">${safeEmail}</div>
                    </div>
                    <button onclick="logout()" class="logout-btn">🚪 Logout</button>
                </div>
            `;
            // Show the user info section
            userInfoEl.style.display = 'flex';
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
