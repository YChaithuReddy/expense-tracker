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

            userInfoEl.innerHTML = `
                <div class="user-info-content">
                    <div class="user-details">
                        <div class="user-name">${safeName}</div>
                        <div class="user-email">${safeEmail}</div>
                    </div>
                    <button onclick="logout()" class="logout-btn">Logout</button>
                </div>
            `;
            userInfoEl.style.display = 'flex';
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
            const redirect = sessionStorage.getItem('redirectAfterLogin') || 'index.html';
            sessionStorage.removeItem('redirectAfterLogin');
            window.location.href = redirect;
            return;
        }
        // Not logged in - stay on login page (this is correct)
    } else {
        // Protected page
        if (hasSession) {
            // User is authenticated, show their info
            displayUserInfo();
            // Trigger expense loading now that auth is confirmed
            if (window.expenseTracker && typeof window.expenseTracker.loadExpenses === 'function') {
                window.expenseTracker.loadExpenses();
            }
        } else {
            // Not authenticated via Supabase session, check localStorage as fallback
            if (!isAuthenticated()) {
                // No session and no localStorage - redirect to login
                console.log('Not authenticated, redirecting to login...');
                sessionStorage.setItem('redirectAfterLogin', pathname);
                window.location.href = 'login.html';
                return;
            }
            // Has localStorage user but no Supabase session - show UI anyway
            // (API calls will fail and trigger proper logout if session is truly invalid)
            displayUserInfo();
            // Trigger expense loading
            if (window.expenseTracker && typeof window.expenseTracker.loadExpenses === 'function') {
                window.expenseTracker.loadExpenses();
            }
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
