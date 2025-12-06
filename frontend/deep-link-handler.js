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
    function handleDeepLink(url) {
        console.log('Deep link received:', url);

        try {
            // Parse the URL
            const urlObj = new URL(url);

            // Check if it's an auth callback
            if (urlObj.protocol === 'expensetracker:' && urlObj.host === 'auth') {
                const params = urlObj.searchParams;
                const token = params.get('token');
                const userParam = params.get('user');
                const error = params.get('error');

                if (token) {
                    // Save auth data
                    localStorage.setItem('authToken', token);

                    if (userParam) {
                        try {
                            const user = JSON.parse(decodeURIComponent(userParam));
                            localStorage.setItem('user', JSON.stringify(user));
                        } catch (e) {
                            console.error('Error parsing user data:', e);
                        }
                    }

                    console.log('OAuth login successful via deep link');

                    // Redirect to main app
                    window.location.href = 'index.html';

                } else if (error) {
                    console.error('OAuth error:', error);
                    // Show error on login page
                    if (window.location.pathname.includes('login')) {
                        const messageEl = document.getElementById('loginMessage');
                        if (messageEl) {
                            messageEl.textContent = 'Google authentication failed. Please try again.';
                            messageEl.className = 'message error';
                            messageEl.style.display = 'block';
                        }
                    }
                }
            }
        } catch (e) {
            console.error('Error handling deep link:', e);
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
