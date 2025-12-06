/**
 * UPI Import - Open UPI apps directly from Expense Tracker
 * Supports Google Pay, PhonePe, Paytm
 */

(function() {
    'use strict';

    // UPI App deep links that work on Android
    const UPI_APPS = {
        gpay: {
            name: 'Google Pay',
            // Use UPI deep link format that GPay handles
            deepLink: 'upi://pay?pa=test@upi&pn=Test&cu=INR',
            fallbackUrl: 'https://play.google.com/store/apps/details?id=com.google.android.apps.nbu.paisa.user'
        },
        phonepe: {
            name: 'PhonePe',
            // PhonePe specific deep link
            deepLink: 'phonepe://pay?pa=test@upi&pn=Test&cu=INR',
            fallbackUrl: 'https://play.google.com/store/apps/details?id=com.phonepe.app'
        },
        paytm: {
            name: 'Paytm',
            // Paytm specific deep link
            deepLink: 'paytmmp://pay?pa=test@upi&pn=Test&cu=INR',
            fallbackUrl: 'https://play.google.com/store/apps/details?id=net.one97.paytm'
        }
    };

    // Check if running in Capacitor
    function isCapacitorApp() {
        return window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform();
    }

    // Open UPI app
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

        // Create a hidden link and click it
        const link = document.createElement('a');
        link.href = app.deepLink;
        link.style.display = 'none';
        document.body.appendChild(link);

        // Track if the app opened
        let appOpened = false;
        const startTime = Date.now();

        // Listen for visibility change (app opened = we go to background)
        const visibilityHandler = function() {
            if (document.hidden) {
                appOpened = true;
            }
        };
        document.addEventListener('visibilitychange', visibilityHandler);

        // Click the link to trigger the deep link
        link.click();

        // Check after a delay if the app opened
        setTimeout(() => {
            document.removeEventListener('visibilitychange', visibilityHandler);
            document.body.removeChild(link);

            if (!appOpened && Date.now() - startTime < 2000) {
                // App didn't open, show error
                if (window.toast) {
                    window.toast.warning(`${app.name} may not be installed. Opening Play Store...`, 'App Not Found');
                }
                // Open Play Store
                window.open(app.fallbackUrl, '_blank');
            } else {
                if (window.toast) {
                    window.toast.success('Take a screenshot of your payment, then come back!', app.name);
                }
            }
        }, 1500);
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
