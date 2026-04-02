/**
 * Supabase Authentication Logic for Expense Tracker
 * Handles user authentication state and protected routes
 */

// ==============================================
// HELPER FUNCTIONS
// ==============================================

function sanitizeHTML(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// ==============================================
// AUTH STATE MANAGEMENT
// ==============================================

function isAuthenticated() {
    const user = localStorage.getItem('user');
    return !!user;
}

// Enterprise role helpers
function isCompanyMode() {
    const user = getCurrentUser();
    return !!(user?.organization_id);
}

function getUserRole() {
    const user = getCurrentUser();
    if (!user?.organization_id) return 'personal';
    return user?.role || 'employee';
}

function getOrganizationId() {
    const user = getCurrentUser();
    return user?.organization_id || null;
}

function isAdmin() { return getUserRole() === 'admin'; }
function isManager() { return getUserRole() === 'manager'; }
function isAccountant() { return getUserRole() === 'accountant'; }
function hasApprovalAccess() { return ['admin', 'manager', 'accountant'].includes(getUserRole()); }

async function checkAuth() {
    const client = window.supabaseClient?.get();
    if (!client) return false;

    try {
        const { data: { session } } = await client.auth.getSession();
        return !!session;
    } catch (error) {
        console.error('Check auth error:', error);
        return false;
    }
}

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

async function fetchCurrentUser() {
    const client = window.supabaseClient?.get();
    if (!client) return null;

    try {
        const { data: { user } } = await client.auth.getUser();
        if (!user) return null;

        // Try to get profile data
        let profile = null;
        try {
            const { data } = await client
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .single();
            profile = data;
        } catch (e) {
            console.log('Profile not found, using auth user data');
        }

        const userData = {
            id: user.id,
            email: user.email,
            name: profile?.name || user.user_metadata?.name || user.user_metadata?.full_name || user.email?.split('@')[0],
            profile_picture: profile?.profile_picture || user.user_metadata?.avatar_url,
            ...profile
        };

        localStorage.setItem('user', JSON.stringify(userData));
        return userData;
    } catch (error) {
        console.error('Fetch user error:', error);
        return null;
    }
}

// ==============================================
// LOGOUT
// ==============================================

async function logout() {
    const client = window.supabaseClient?.get();

    // Set logout flag BEFORE signOut to prevent redirect loop
    sessionStorage.setItem('just_logged_out', 'true');

    if (client) {
        try {
            await client.auth.signOut({ scope: 'global' });
        } catch (e) {
            console.log('SignOut error (ignored):', e);
        }
    }

    // Clear all auth-related storage
    localStorage.removeItem('user');
    localStorage.removeItem('authToken');
    localStorage.removeItem('expense-tracker-auth');

    // Redirect to login
    window.location.href = 'login.html';
}

// ==============================================
// ROUTE PROTECTION
// ==============================================

function requireAuth() {
    if (!isAuthenticated()) {
        const currentPath = window.location.pathname + window.location.search;
        sessionStorage.setItem('redirectAfterLogin', currentPath);
        window.location.href = 'login.html';
        return false;
    }
    return true;
}

async function requireAuthAsync() {
    const authenticated = await checkAuth();

    if (!authenticated) {
        const currentPath = window.location.pathname + window.location.search;
        sessionStorage.setItem('redirectAfterLogin', currentPath);
        window.location.href = 'login.html';
        return false;
    }

    return true;
}

// ==============================================
// UI HELPERS
// ==============================================

function displayUserInfo() {
    const user = getCurrentUser();
    if (user) {
        const userInfoEl = document.getElementById('userInfo');
        if (userInfoEl) {
            const safeName = sanitizeHTML(user.name);
            const safeEmail = sanitizeHTML(user.email);
            const isCompany = !!user.organization_id;
            const role = user.role || 'employee';

            // Enterprise icons (only for company mode users)
            const roleBadge = isCompany ? `<span class="role-badge role-badge--${role}">${role.toUpperCase()}</span>` : '';
            const adminBtn = role === 'admin' ? `<button class="theme-toggle-btn" onclick="adminPanel.open()" aria-label="Admin Panel" title="Admin Panel"><span class="theme-icon">&#9881;</span></button>` : '';
            const notifBtn = isCompany ? `<button class="theme-toggle-btn notif-bell-btn" id="notifBellBtn" onclick="notificationCenter.toggle()" aria-label="Notifications" title="Notifications"><span class="theme-icon">🔔</span><span class="notif-badge" id="notifBadge" style="display:none;">0</span></button>` : '';
            const approvalsBtn = isCompany ? `<button class="theme-toggle-btn" onclick="approvalWorkflow.openApprovalsPanel()" aria-label="Approvals" title="Approvals"><span class="theme-icon">&#9989;</span></button>` : '';

            userInfoEl.innerHTML = `
                <div class="user-info-content">
                    <button class="theme-toggle-btn" onclick="expenseTracker.toggleTheme()" aria-label="Toggle Theme" title="Switch Theme">
                        <span class="theme-icon" id="themeIcon">🎨</span>
                    </button>
                    <div class="user-details">
                        <div class="user-name">${safeName}</div>
                        <div class="user-email">${safeEmail}</div>
                        ${roleBadge}
                    </div>
                    ${adminBtn}
                    ${notifBtn}
                    ${approvalsBtn}
                    <button class="theme-toggle-btn" onclick="activityLog.open()" aria-label="Activity Log" title="Activity Log">
                        <span class="theme-icon">📋</span>
                    </button>
                    <button onclick="logout()" class="logout-btn">Logout</button>
                </div>
            `;
            userInfoEl.style.display = 'flex';

            // Update theme icon to match current theme
            if (window.expenseTracker) {
                const currentTheme = document.documentElement.getAttribute('data-theme') || 'teal';
                window.expenseTracker.updateThemeButtonUI(currentTheme);
            }

            // Refresh notification badge if in company mode
            if (isCompany && typeof notificationCenter !== 'undefined') {
                notificationCenter.refreshCount();
            }
        }
    }
}

// ==============================================
// OAUTH CALLBACK & SESSION HANDLING
// ==============================================

async function handleAuthCallback() {
    const client = window.supabaseClient?.get();
    if (!client) {
        console.log('Waiting for Supabase client...');
        return false;
    }

    // Check for hash params (OAuth callback)
    const hash = window.location.hash;
    if (hash && hash.includes('access_token')) {
        console.log('OAuth callback detected');

        // Supabase should automatically handle the tokens from the hash
        // Just wait a moment for it to process
        await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Check if we have a session now
    const { data: { session } } = await client.auth.getSession();

    if (session) {
        console.log('Session found, user is authenticated');

        // Verify company domain (block non-fluxgentech.com Google logins)
        const sessionEmail = session.user?.email?.toLowerCase();
        if (sessionEmail && !sessionEmail.endsWith('@fluxgentech.com')) {
            console.warn('Non-company email blocked:', sessionEmail);
            const client = window.supabaseClient?.get();
            if (client) await client.auth.signOut();
            localStorage.removeItem('user');
            alert('Only @fluxgentech.com email addresses are allowed.');
            window.location.href = 'login.html';
            return false;
        }

        // Fetch and store user data
        await fetchCurrentUser();

        // Clean up URL hash
        if (window.location.hash) {
            history.replaceState(null, '', window.location.pathname + window.location.search);
        }

        return true;
    }

    return false;
}

// ==============================================
// INITIALIZATION
// ==============================================

async function initAuth() {
    console.log('Initializing auth...');

    // Check if deep link handler is processing OAuth - wait for it
    const hash = window.location.hash;
    if (hash && hash.includes('access_token')) {
        console.log('OAuth tokens in URL, waiting for deep link handler to process...');
        // Give deep link handler time to process
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Wait for Supabase client
    let attempts = 0;
    while (!window.supabaseClient?.get() && attempts < 50) {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
    }

    const client = window.supabaseClient?.get();
    if (!client) {
        console.error('Supabase client not available after waiting');
        return;
    }

    const pathname = window.location.pathname;
    // Handle both with and without .html extension (for Vercel clean URLs)
    const isPublicPage = pathname.includes('login') || pathname.includes('signup');

    // Handle OAuth callback
    const hasSession = await handleAuthCallback();

    console.log('Auth check:', { pathname, isPublicPage, hasSession, hasLocalStorage: isAuthenticated() });

    if (isPublicPage) {
        // On login/signup page
        // Check if user just logged out - don't redirect back
        const justLoggedOut = sessionStorage.getItem('just_logged_out');
        if (justLoggedOut) {
            console.log('User just logged out, staying on login page');
            sessionStorage.removeItem('just_logged_out');
            return;
        }

        if (hasSession && isAuthenticated()) {
            // Already logged in (both session AND localStorage user exist), redirect to app
            console.log('Already authenticated, redirecting to app...');
            const savedRedirect = sessionStorage.getItem('redirectAfterLogin');
            sessionStorage.removeItem('redirectAfterLogin');
            // Role-based redirect
            const user = getCurrentUser();
            const userEmail = user?.email?.toLowerCase();
            const defaultRedirect = userEmail === 'admin@fluxgentech.com' ? 'admin.html'
                : (userEmail === 'accountant@fluxgentech.com' || user?.role === 'accountant') ? 'accountant.html'
                : 'index.html';
            const redirect = savedRedirect || defaultRedirect;
            const safeRedirect = /^[a-zA-Z0-9_./-]+\.html$/.test(redirect) ? redirect : defaultRedirect;
            window.location.href = safeRedirect;
            return;
        }
        // Not logged in - stay on login page (this is correct)
    } else {
        // Protected page
        if (hasSession) {
            // Block admin/accountant from index.html — redirect to their dashboard
            const currentUser = getCurrentUser();
            const curEmail = currentUser?.email?.toLowerCase();
            if (curEmail === 'admin@fluxgentech.com' && !pathname.includes('admin')) {
                window.location.href = 'admin.html';
                return;
            }
            const isAcctPage = pathname.includes('accountant') || pathname.includes('login') || pathname.includes('admin');
            if (!isAcctPage && (curEmail === 'accountant@fluxgentech.com' || currentUser?.role === 'accountant')) {
                window.location.href = 'accountant.html';
                return;
            }

            // User is authenticated, show their info
            displayUserInfo();
            // Trigger expense loading now that auth is confirmed
            if (window.expenseTracker && typeof window.expenseTracker.loadExpenses === 'function') {
                window.expenseTracker.loadExpenses();
            }
        } else {
            // No active Supabase session - redirect to login
            console.log('Not authenticated, redirecting to login...');
            sessionStorage.setItem('redirectAfterLogin', pathname);
            window.location.href = 'login.html';
            return;
        }
    }
}

// Initialize on page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAuth);
} else {
    initAuth();
}

// ==============================================
// EXPORTS
// ==============================================

window.auth = {
    isAuthenticated,
    checkAuth,
    getCurrentUser,
    fetchCurrentUser,
    logout,
    requireAuth,
    requireAuthAsync,
    displayUserInfo
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        isAuthenticated,
        checkAuth,
        getCurrentUser,
        fetchCurrentUser,
        logout,
        requireAuth,
        requireAuthAsync,
        displayUserInfo
    };
}
