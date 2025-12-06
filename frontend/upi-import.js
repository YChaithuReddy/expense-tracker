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
            playStore: 'https://play.google.com/store/apps/details?id=com.google.android.apps.nbu.paisa.user'
        },
        phonepe: {
            name: 'PhonePe',
            package: 'com.phonepe.app',
            playStore: 'https://play.google.com/store/apps/details?id=com.phonepe.app'
        },
        paytm: {
            name: 'Paytm',
            package: 'net.one97.paytm',
            playStore: 'https://play.google.com/store/apps/details?id=net.one97.paytm'
        }
    };

    // Check if running in Capacitor
    function isCapacitorApp() {
        return window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform();
    }

    // Open UPI app using Android Intent
    async function openUPIApp(appKey) {
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

        if (isCapacitorApp()) {
            try {
                // Use Capacitor App plugin to open the app
                const { App } = window.Capacitor.Plugins;

                // Try to open the app directly using package name
                const intentUrl = `intent://#Intent;package=${app.package};end`;

                try {
                    await App.openUrl({ url: intentUrl });
                    console.log('Opened via intent URL');

                    if (window.toast) {
                        window.toast.success('Take a screenshot of your payment, then come back!', app.name + ' Opened');
                    }
                    return;
                } catch (e) {
                    console.log('Intent URL failed, trying market URL:', e);
                }

                // Try market URL (opens Play Store if app not installed)
                try {
                    await App.openUrl({ url: `market://details?id=${app.package}` });
                    return;
                } catch (e) {
                    console.log('Market URL failed:', e);
                }

                // Fallback to Play Store web URL
                window.open(app.playStore, '_system');

            } catch (error) {
                console.error('Error opening UPI app:', error);

                if (window.toast) {
                    window.toast.error(`Could not open ${app.name}. Make sure it's installed.`, 'Error');
                }
            }
        } else {
            // On web, show message
            if (window.toast) {
                window.toast.info(`Open ${app.name} on your phone, take a screenshot, then upload it here.`, 'UPI Import');
            }
        }
    }

    // Initialize button click handlers
    function initButtons() {
        // Google Pay button
        const gpayBtn = document.getElementById('gpayBtn');
        if (gpayBtn) {
            gpayBtn.addEventListener('click', function(e) {
                e.preventDefault();
                openUPIApp('gpay');
            });
        }

        // PhonePe button
        const phonepeBtn = document.getElementById('phonepeBtn');
        if (phonepeBtn) {
            phonepeBtn.addEventListener('click', function(e) {
                e.preventDefault();
                openUPIApp('phonepe');
            });
        }

        // Paytm button
        const paytmBtn = document.getElementById('paytmBtn');
        if (paytmBtn) {
            paytmBtn.addEventListener('click', function(e) {
                e.preventDefault();
                openUPIApp('paytm');
            });
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
