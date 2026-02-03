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
            upiScheme: 'tez://upi/',
            fallbackUrl: 'https://play.google.com/store/apps/details?id=com.google.android.apps.nbu.paisa.user'
        },
        phonepe: {
            name: 'PhonePe',
            package: 'com.phonepe.app',
            upiScheme: 'phonepe://',
            fallbackUrl: 'https://play.google.com/store/apps/details?id=com.phonepe.app'
        },
        paytm: {
            name: 'Paytm',
            package: 'net.one97.paytm',
            upiScheme: 'paytmmp://',
            fallbackUrl: 'https://play.google.com/store/apps/details?id=net.one97.paytm'
        }
    };

    // Check if running in Capacitor native app
    function isCapacitorApp() {
        return window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform();
    }

    // Check if running on Android
    function isAndroid() {
        return /android/i.test(navigator.userAgent);
    }

    // Wait for AppLauncher to be available
    function waitForAppLauncher(callback, maxAttempts = 20) {
        let attempts = 0;
        const check = () => {
            attempts++;
            if (window.AppLauncher) {
                console.log('AppLauncher found after', attempts, 'attempts');
                callback(true);
            } else if (window.AppLauncherReady) {
                // AppLauncher was flagged as ready but object not found - retry
                console.log('AppLauncherReady flag set, retrying...');
                setTimeout(check, 50);
            } else if (attempts < maxAttempts) {
                setTimeout(check, 100);
            } else {
                console.log('AppLauncher not found after', maxAttempts, 'attempts');
                callback(false);
            }
        };
        check();
    }

    // Callback for async app launch results - use separate object to not shadow Java bridge
    window.AppLauncherCallbacks = window.AppLauncherCallbacks || {};
    window.AppLauncherCallbacks.onResult = function(packageName, success, message) {
        console.log('AppLauncher result:', packageName, success, message);
        if (success) {
            if (window.toast) {
                window.toast.success('Take a screenshot of your payment, then come back!', 'App Opened');
            }
        } else {
            if (window.toast) {
                window.toast.warning(message || 'Could not open app', 'Error');
            }
        }
    };

    // Called when AppLauncher Java bridge is ready
    window.onAppLauncherReady = function() {
        console.log('AppLauncher bridge is ready!');
        console.log('AppLauncher methods:', window.AppLauncher ? Object.keys(window.AppLauncher) : 'not available');
    };

    // Open app using Android intent URL scheme
    function openWithIntentScheme(app) {
        // Android intent URL format to open an app
        const intentUrl = `intent://#Intent;package=${app.package};scheme=https;end`;

        console.log('Trying intent URL:', intentUrl);

        try {
            window.location.href = intentUrl;
            return true;
        } catch (e) {
            console.error('Intent URL failed:', e);
            return false;
        }
    }

    // Open app using its custom URL scheme
    function openWithUpiScheme(app) {
        if (!app.upiScheme) return false;

        console.log('Trying UPI scheme:', app.upiScheme);

        try {
            // Create a hidden iframe to test if the scheme works
            const iframe = document.createElement('iframe');
            iframe.style.display = 'none';
            iframe.src = app.upiScheme;
            document.body.appendChild(iframe);

            // Also try direct navigation
            setTimeout(() => {
                window.location.href = app.upiScheme;
            }, 100);

            // Clean up iframe
            setTimeout(() => {
                document.body.removeChild(iframe);
            }, 2000);

            return true;
        } catch (e) {
            console.error('UPI scheme failed:', e);
            return false;
        }
    }

    // Open UPI app using native Android bridge
    function openUPIApp(appKey) {
        const app = UPI_APPS[appKey];
        if (!app) {
            console.error('Unknown UPI app:', appKey);
            return;
        }

        console.log('Opening UPI app:', app.name, app.package);
        console.log('isCapacitorApp:', isCapacitorApp());
        console.log('isAndroid:', isAndroid());
        console.log('AppLauncher available:', !!window.AppLauncher);
        console.log('UserAgent:', navigator.userAgent);

        // Show loading toast
        if (window.toast) {
            window.toast.info(`Opening ${app.name}...`, 'UPI Import');
        }

        // Method 1: Try native AppLauncher bridge (injected by Java)
        const hasAppLauncher = window.AppLauncher &&
            typeof window.AppLauncher.openApp === 'function' &&
            typeof window.AppLauncher.isAppInstalled === 'function';

        console.log('AppLauncher check:', {
            exists: !!window.AppLauncher,
            hasOpenApp: window.AppLauncher && typeof window.AppLauncher.openApp === 'function',
            hasIsAppInstalled: window.AppLauncher && typeof window.AppLauncher.isAppInstalled === 'function',
            allMethods: window.AppLauncher ? Object.getOwnPropertyNames(window.AppLauncher) : []
        });

        if (hasAppLauncher) {
            console.log('Using AppLauncher bridge');
            try {
                // First check if app is installed
                const isInstalled = window.AppLauncher.isAppInstalled(app.package);
                console.log('App installed check:', isInstalled);

                if (!isInstalled) {
                    if (window.toast) {
                        window.toast.warning(`${app.name} is not installed. Opening Play Store...`, 'App Not Found');
                    }
                    // Try to open Play Store
                    if (window.AppLauncher.openPlayStore) {
                        window.AppLauncher.openPlayStore(app.package);
                    } else {
                        window.open(app.fallbackUrl, '_blank');
                    }
                    return;
                }

                // Try async method first (more reliable)
                if (typeof window.AppLauncher.openAppAsync === 'function') {
                    console.log('Using async app launch');
                    window.AppLauncher.openAppAsync(app.package);
                    return;
                }

                // Fallback to sync method
                const success = window.AppLauncher.openApp(app.package);
                if (success) {
                    setTimeout(() => {
                        if (window.toast) {
                            window.toast.success('Take a screenshot of your payment, then come back!', app.name);
                        }
                    }, 500);
                    return;
                } else {
                    console.log('AppLauncher returned false');
                    if (window.toast) {
                        window.toast.warning(`Could not open ${app.name}`, 'Error');
                    }
                    return;
                }
            } catch (e) {
                console.error('AppLauncher error:', e);
            }
        }

        // Method 2: If on Android (mobile browser or Capacitor), try intent URL
        if (isAndroid()) {
            console.log('Trying Android intent methods');

            // Wait a bit for AppLauncher in case it's loading
            waitForAppLauncher((found) => {
                if (found && window.AppLauncher) {
                    try {
                        const success = window.AppLauncher.openApp(app.package);
                        if (success) {
                            if (window.toast) {
                                window.toast.success('Take a screenshot of your payment, then come back!', app.name);
                            }
                            return;
                        }
                    } catch (e) {
                        console.error('Delayed AppLauncher failed:', e);
                    }
                }

                // Try intent URL scheme
                const intentOpened = openWithIntentScheme(app);
                if (!intentOpened) {
                    // Try custom URL scheme
                    openWithUpiScheme(app);
                }

                // Show success message (we can't know for sure if it worked)
                setTimeout(() => {
                    if (window.toast) {
                        window.toast.info('If the app opened, take a screenshot and come back!', app.name);
                    }
                }, 1500);
            });
            return;
        }

        // Method 3: Web browser - show message
        if (window.toast) {
            window.toast.warning('UPI apps can only be opened on Android devices. Please use this feature on your Android phone.', 'Mobile Required');
        }
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
