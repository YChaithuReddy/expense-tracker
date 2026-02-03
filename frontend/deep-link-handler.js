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

                    const supabase = window.supabaseClient?.get();
                    if (supabase) {
                        try {
                            // Set the session with the tokens
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
                                await window.auth.fetchCurrentUser();
                            }

                            // Redirect to main app
                            window.location.href = 'index.html';
                            return;
                        } catch (e) {
                            console.error('Error setting Supabase session:', e);
                        }
                    } else {
                        console.error('Supabase client not available');
                    }

                    // Fallback: store token and redirect
                    localStorage.setItem('authToken', accessToken);
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

    // Initialize deep link handling
    function initDeepLinkHandler() {
        if (!isCapacitorApp()) {
            return; // Only run in Capacitor app
        }

        // Import Capacitor App plugin
        if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App) {
            const App = window.Capacitor.Plugins.App;

            // Listen for app URL open events
            App.addListener('appUrlOpen', (event) => {
                console.log('App URL opened:', event.url);
                handleDeepLink(event.url);
            });

            // Check if app was launched with a URL
            App.getLaunchUrl().then((result) => {
                if (result && result.url) {
                    console.log('App launched with URL:', result.url);
                    handleDeepLink(result.url);
                }
            }).catch((err) => {
                console.log('No launch URL:', err);
            });
        }
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initDeepLinkHandler);
    } else {
        initDeepLinkHandler();
    }

    // Also try to initialize after a short delay (for Capacitor plugin loading)
    setTimeout(initDeepLinkHandler, 500);

    // Export for manual use
    window.handleDeepLink = handleDeepLink;
})();
