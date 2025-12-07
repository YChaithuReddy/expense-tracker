/**
 * UPI Import - Open UPI apps directly from Expense Tracker
 * Supports Google Pay, PhonePe, Paytm
 */

(function() {
    'use strict';

    // UPI App package names for Android
    const UPI_APPS = {
        gpay: {
            name: 'Google Pay',
            package: 'com.google.android.apps.nbu.paisa.user',
            fallbackUrl: 'https://play.google.com/store/apps/details?id=com.google.android.apps.nbu.paisa.user'
        },
        phonepe: {
            name: 'PhonePe',
            package: 'com.phonepe.app',
            fallbackUrl: 'https://play.google.com/store/apps/details?id=com.phonepe.app'
        },
        paytm: {
            name: 'Paytm',
            package: 'net.one97.paytm',
            fallbackUrl: 'https://play.google.com/store/apps/details?id=net.one97.paytm'
        }
    };

    // Check if running in Capacitor
    function isCapacitorApp() {
        return window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform();
    }

    // Open UPI app using Android Intent
    function openUPIApp(appKey) {
        const app = UPI_APPS[appKey];
        if (!app) {
            console.error('Unknown UPI app:', appKey);
            return;
        }

        console.log('Opening UPI app:', app.name);

        // Show toast
        if (window.toast) {
            window.toast.info(`Opening ${app.name}...`, 'UPI Import');
        }

        // Use Android Intent URL format to launch app
        // Format: intent://...#Intent;package=...;end
        const intentUrl = `intent://#Intent;package=${app.package};launchFlags=0x10000000;end`;

        // Create iframe to trigger intent (works better in WebView)
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        iframe.src = intentUrl;
        document.body.appendChild(iframe);

        // Track if app opened
        let appOpened = false;
        const visibilityHandler = function() {
            if (document.hidden) {
                appOpened = true;
            }
        };
        document.addEventListener('visibilitychange', visibilityHandler);

        // Cleanup and show message after delay
        setTimeout(() => {
            document.removeEventListener('visibilitychange', visibilityHandler);
            if (iframe.parentNode) {
                iframe.parentNode.removeChild(iframe);
            }

            if (appOpened) {
                if (window.toast) {
                    window.toast.success('Take a screenshot of your payment, then come back!', app.name);
                }
            } else {
                // Try fallback - direct window.location
                window.location.href = intentUrl;

                // If still here after 500ms, app probably not installed
                setTimeout(() => {
                    if (!document.hidden) {
                        if (window.toast) {
                            window.toast.warning(`${app.name} may not be installed.`, 'App Not Found');
                        }
                    }
                }, 500);
            }
        }, 1000);
    }

    // Initialize button click handlers
    function initButtons() {
        // Google Pay button
        const gpayBtn = document.getElementById('gpayBtn');
        if (gpayBtn) {
            gpayBtn.onclick = function(e) {
                e.preventDefault();
                e.stopPropagation();
                openUPIApp('gpay');
                return false;
            };
        }

        // PhonePe button
        const phonepeBtn = document.getElementById('phonepeBtn');
        if (phonepeBtn) {
            phonepeBtn.onclick = function(e) {
                e.preventDefault();
                e.stopPropagation();
                openUPIApp('phonepe');
                return false;
            };
        }

        // Paytm button
        const paytmBtn = document.getElementById('paytmBtn');
        if (paytmBtn) {
            paytmBtn.onclick = function(e) {
                e.preventDefault();
                e.stopPropagation();
                openUPIApp('paytm');
                return false;
            };
        }

        // UPI Import button in action buttons section
        const upiImportBtn = document.getElementById('upiImportBtn');
        if (upiImportBtn) {
            upiImportBtn.onclick = function(e) {
                e.preventDefault();
                e.stopPropagation();
                // Show and scroll to UPI import section
                const upiSection = document.getElementById('upiImportSection');
                if (upiSection) {
                    // Show the section
                    upiSection.style.display = 'block';
                    // Scroll to it
                    setTimeout(() => {
                        upiSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        // Add a highlight effect
                        upiSection.style.transition = 'box-shadow 0.3s ease';
                        upiSection.style.boxShadow = '0 0 20px rgba(20, 184, 166, 0.5)';
                        setTimeout(() => {
                            upiSection.style.boxShadow = '';
                        }, 1500);
                    }, 100);
                }
                return false;
            };
        }

        // Close button for UPI section
        const upiCloseBtn = document.getElementById('upiCloseBtn');
        if (upiCloseBtn) {
            upiCloseBtn.onclick = function(e) {
                e.preventDefault();
                e.stopPropagation();
                const upiSection = document.getElementById('upiImportSection');
                if (upiSection) {
                    upiSection.style.display = 'none';
                }
                return false;
            };
        }

        console.log('UPI Import buttons initialized');
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initButtons);
    } else {
        initButtons();
    }

    // Also try after a short delay (for dynamic content)
    setTimeout(initButtons, 1000);

    // Export for external use
    window.upiImport = {
        openUPIApp
    };

})();
