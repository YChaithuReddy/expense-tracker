/**
 * Deep Link Handler for Capacitor App
 * Handles OAuth callbacks via custom URL scheme (expensetracker://auth)
 */

(function() {
    'use strict';

    // Check if running in Capacitor
    function isCapacitorApp() {
        return window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform();
    }

    // Handle deep link URL
    async function handleDeepLink(url) {
        console.log('Deep link received:', url);

        try {
            // Parse the URL
            const urlObj = new URL(url);

            // Check if it's an auth callback
            if (urlObj.protocol === 'expensetracker:' && urlObj.host === 'auth') {
                console.log('Auth callback detected');

                // Supabase OAuth returns tokens in hash fragment
                // URL format: expensetracker://auth#access_token=xxx&refresh_token=xxx&...
                const hashParams = new URLSearchParams(urlObj.hash.substring(1));
                const accessToken = hashParams.get('access_token');
                const refreshToken = hashParams.get('refresh_token');
                const error = hashParams.get('error') || urlObj.searchParams.get('error');
                const errorDescription = hashParams.get('error_description') || urlObj.searchParams.get('error_description');

                console.log('OAuth params:', { hasAccessToken: !!accessToken, hasRefreshToken: !!refreshToken, error });

                if (accessToken && refreshToken) {
                    console.log('Tokens received, setting session...');

                    // Wait for Supabase client to be ready
                    let attempts = 0;
                    while (!window.supabaseClient?.get() && attempts < 50) {
                        await new Promise(resolve => setTimeout(resolve, 100));
                        attempts++;
                    }
                    console.log('Supabase client ready after', attempts, 'attempts');

                    const supabase = window.supabaseClient?.get();
                    if (supabase) {
                        try {
                            // Set the session with the tokens
                            console.log('Setting Supabase session with tokens...');
                            const { data, error: sessionError } = await supabase.auth.setSession({
                                access_token: accessToken,
                                refresh_token: refreshToken
                            });

                            if (sessionError) {
                                console.error('Error setting session:', sessionError);
                                throw sessionError;
                            }

                            console.log('Session set successfully:', data?.user?.email);

                            // Fetch and store user data
                            if (window.auth?.fetchCurrentUser) {
                                console.log('Fetching current user...');
                                await window.auth.fetchCurrentUser();
                            }

                            // Store user info directly as backup
                            if (data?.user) {
                                const userInfo = {
                                    id: data.user.id,
                                    email: data.user.email,
                                    name: data.user.user_metadata?.name || data.user.user_metadata?.full_name || data.user.email?.split('@')[0]
                                };
                                localStorage.setItem('user', JSON.stringify(userInfo));
                                console.log('User stored in localStorage:', userInfo.email);
                            }

                            // Small delay to ensure storage is synced
                            await new Promise(resolve => setTimeout(resolve, 200));

                            // Redirect to main app
                            console.log('Redirecting to index.html...');
                            window.location.href = 'index.html';
                            return;
                        } catch (e) {
                            console.error('Error setting Supabase session:', e);
                        }
                    } else {
                        console.error('Supabase client not available after waiting');
                    }

                    // Fallback: store token and user info, then redirect
                    console.log('Using fallback: storing token directly');
                    localStorage.setItem('authToken', accessToken);
                    // Try to decode JWT to get user info
                    try {
                        const payload = JSON.parse(atob(accessToken.split('.')[1]));
                        if (payload.email) {
                            const userInfo = {
                                id: payload.sub,
                                email: payload.email,
                                name: payload.email.split('@')[0]
                            };
                            localStorage.setItem('user', JSON.stringify(userInfo));
                        }
                    } catch (e) {
                        console.log('Could not decode token:', e);
                    }
                    window.location.href = 'index.html';

                } else if (error) {
                    console.error('OAuth error:', error, errorDescription);
                    // Redirect to login with error
                    window.location.href = 'login.html?error=' + encodeURIComponent(errorDescription || error);
                } else {
                    // No tokens and no error - might be a different format
                    // Check for legacy format with token param
                    const legacyToken = urlObj.searchParams.get('token');
                    if (legacyToken) {
                        localStorage.setItem('authToken', legacyToken);
                        window.location.href = 'index.html';
                    } else {
                        console.log('Unknown deep link format, redirecting to login');
                        window.location.href = 'login.html';
                    }
                }
            }
        } catch (e) {
            console.error('Error handling deep link:', e);
            window.location.href = 'login.html?error=' + encodeURIComponent('Authentication failed');
        }
    }

    // Track if listener is already added
    let listenerAdded = false;

    // Initialize deep link handling
    function initDeepLinkHandler() {
        console.log('initDeepLinkHandler called, isCapacitor:', isCapacitorApp(), 'listenerAdded:', listenerAdded);

        if (!isCapacitorApp()) {
            console.log('Not a Capacitor app, skipping deep link handler');
            return;
        }

        if (listenerAdded) {
            console.log('Listener already added, skipping');
            return;
        }

        // Import Capacitor App plugin
        if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App) {
            const App = window.Capacitor.Plugins.App;

            console.log('Adding appUrlOpen listener...');
            listenerAdded = true;

            // Listen for app URL open events
            App.addListener('appUrlOpen', (event) => {
                console.log('=== appUrlOpen EVENT FIRED ===');
                console.log('App URL opened:', event.url);
                handleDeepLink(event.url);
            });

            // Check if app was launched with a URL
            App.getLaunchUrl().then((result) => {
                console.log('getLaunchUrl result:', result);
                if (result && result.url) {
                    console.log('App launched with URL:', result.url);
                    handleDeepLink(result.url);
                }
            }).catch((err) => {
                console.log('No launch URL:', err);
            });

            console.log('Deep link handler initialized successfully');
        } else {
            console.log('Capacitor App plugin not available yet');
        }
    }

    // Check for pending deep link in URL (fallback for when event doesn't fire)
    function checkUrlForDeepLink() {
        const hash = window.location.hash;
        if (hash && hash.includes('access_token')) {
            console.log('Found OAuth tokens in current URL hash, processing...');
            const fakeUrl = 'expensetracker://auth' + hash;
            handleDeepLink(fakeUrl);
        }
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            initDeepLinkHandler();
            checkUrlForDeepLink();
        });
    } else {
        initDeepLinkHandler();
        checkUrlForDeepLink();
    }

    // Also try to initialize after a short delay (for Capacitor plugin loading)
    setTimeout(initDeepLinkHandler, 500);
    setTimeout(initDeepLinkHandler, 1500); // Extra attempt

    // Export for manual use
    window.handleDeepLink = handleDeepLink;
})();
