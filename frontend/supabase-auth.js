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
            const adminBtn = role === 'admin' ? `<button class="header-icon-btn" onclick="window.location.href='admin.html'" aria-label="Admin Dashboard" title="Admin Dashboard"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg></button>` : '';
            const notifBtn = isCompany ? `<button class="header-icon-btn notif-bell-btn" id="notifBellBtn" onclick="notificationCenter.toggle()" aria-label="Notifications" title="Notifications"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg><span class="notif-badge" id="notifBadge" style="display:none;">0</span></button>` : '';
            const approvalsBtn = isCompany ? `<button class="header-icon-btn" onclick="approvalWorkflow.openApprovalsPanel()" aria-label="Approvals" title="Approvals"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg><span class="notif-badge" id="approvalBadge" style="display:none;">0</span></button>` : '';

            userInfoEl.innerHTML = `
                <div class="user-info-name-row">
                    <div class="user-details">
                        <div class="user-email">${safeEmail}</div>
                        ${roleBadge}
                    </div>
                </div>
                <div class="user-info-content">
                    ${adminBtn}
                    ${notifBtn}
                    ${approvalsBtn}
                    <button class="header-icon-btn" onclick="activityLog.open()" aria-label="Activity Log" title="Activity Log">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>
                    </button>
                    <button class="header-icon-btn" onclick="openProfileModal()" aria-label="Profile" title="Profile">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                    </button>
                </div>
            `;
            userInfoEl.style.display = 'flex';

            // Notification badge refresh is handled by notificationCenter.init()
            // called from onAuthReady() — no duplicate call needed here
        }

        // Update sidebar user block (name, email, avatar initials)
        const sidebarName = document.getElementById('sidebarUserName');
        const sidebarEmail = document.getElementById('sidebarUserEmail');
        const sidebarAvatar = document.getElementById('sidebarAvatar');
        if (sidebarName) sidebarName.textContent = user.name || 'User';
        if (sidebarEmail) sidebarEmail.textContent = user.email || '';
        if (sidebarAvatar) {
            const parts = (user.name || '').split(' ').filter(Boolean);
            sidebarAvatar.textContent = parts.length >= 2
                ? parts[0][0].toUpperCase() + parts[parts.length - 1][0].toUpperCase()
                : parts[0] ? parts[0][0].toUpperCase() : 'U';
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
                : userEmail === 'accountant@fluxgentech.com' ? 'accountant.html'
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
            if (!isAcctPage && curEmail === 'accountant@fluxgentech.com') {
                window.location.href = 'accountant.html';
                return;
            }

            // User is authenticated, show their info
            displayUserInfo();
            // Trigger expense loading now that auth is confirmed
            if (window.expenseTracker) {
                if (typeof window.expenseTracker.loadExpenses === 'function') {
                    window.expenseTracker.loadExpenses();
                }
                // Initialize non-critical services (deferred from constructor)
                if (typeof window.expenseTracker.onAuthReady === 'function') {
                    window.expenseTracker.onAuthReady();
                }
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

// Initialize on page load — skip on admin/accountant pages (they handle auth via localStorage)
const _authPath = window.location.pathname;
const _skipAuth = _authPath.includes('admin') || _authPath.includes('accountant');
if (!_skipAuth) {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initAuth);
    } else {
        initAuth();
    }
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
