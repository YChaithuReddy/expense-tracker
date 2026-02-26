package com.expensetracker.app;

import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.PackageInfo;
import android.net.Uri;
import android.os.Bundle;
import android.os.Environment;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import android.webkit.WebSettings;

import androidx.core.content.FileProvider;

import com.getcapacitor.BridgeActivity;

import java.io.File;

public class MainActivity extends BridgeActivity {

    private static final String TAG = "ExpenseTracker";
    private WebView webView;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Get WebView and configure it
        webView = getBridge().getWebView();

        // Enable JavaScript
        WebSettings webSettings = webView.getSettings();
        webSettings.setJavaScriptEnabled(true);
        webSettings.setDomStorageEnabled(true);

        // Add JavaScript interface for opening apps
        webView.addJavascriptInterface(new AppLauncher(), "AppLauncher");
        Log.d(TAG, "AppLauncher JavaScript interface registered");

        // Notify JavaScript that AppLauncher is ready
        new Handler(Looper.getMainLooper()).postDelayed(() -> {
            webView.evaluateJavascript(
                "window.AppLauncherReady = true; " +
                "if (window.onAppLauncherReady) window.onAppLauncherReady(); " +
                "console.log('AppLauncher is ready');",
                null
            );
        }, 500);
    }

    // JavaScript interface to launch Android apps
    public class AppLauncher {

        @JavascriptInterface
        public boolean openApp(String packageName) {
            Log.d(TAG, "openApp called with package: " + packageName);

            // Run on UI thread
            final boolean[] result = {false};
            final Object lock = new Object();

            runOnUiThread(() -> {
                try {
                    PackageManager pm = getPackageManager();

                    // First check if the app is installed
                    if (!isAppInstalledInternal(packageName)) {
                        Log.w(TAG, "App not installed: " + packageName);
                        synchronized (lock) {
                            result[0] = false;
                            lock.notify();
                        }
                        return;
                    }

                    // Get the launch intent for the package
                    Intent intent = pm.getLaunchIntentForPackage(packageName);
                    if (intent != null) {
                        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                        intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP);
                        Log.d(TAG, "Launching app: " + packageName);
                        startActivity(intent);
                        synchronized (lock) {
                            result[0] = true;
                            lock.notify();
                        }
                    } else {
                        Log.w(TAG, "Could not get launch intent for: " + packageName);
                        synchronized (lock) {
                            result[0] = false;
                            lock.notify();
                        }
                    }
                } catch (Exception e) {
                    Log.e(TAG, "Error launching app: " + packageName, e);
                    synchronized (lock) {
                        result[0] = false;
                        lock.notify();
                    }
                }
            });

            // Wait for result (with timeout)
            synchronized (lock) {
                try {
                    lock.wait(2000);
                } catch (InterruptedException e) {
                    Log.e(TAG, "Interrupted while waiting for app launch");
                }
            }

            return result[0];
        }

        @JavascriptInterface
        public boolean openAppAsync(String packageName) {
            Log.d(TAG, "openAppAsync called with package: " + packageName);

            runOnUiThread(() -> {
                try {
                    PackageManager pm = getPackageManager();

                    if (!isAppInstalledInternal(packageName)) {
                        Log.w(TAG, "App not installed: " + packageName);
                        notifyJavaScript("AppLauncher.onResult", packageName, false, "App not installed");
                        return;
                    }

                    Intent intent = pm.getLaunchIntentForPackage(packageName);
                    if (intent != null) {
                        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                        intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP);
                        Log.d(TAG, "Launching app async: " + packageName);
                        startActivity(intent);
                        notifyJavaScript("AppLauncher.onResult", packageName, true, "Success");
                    } else {
                        Log.w(TAG, "Could not get launch intent for: " + packageName);
                        notifyJavaScript("AppLauncher.onResult", packageName, false, "No launch intent");
                    }
                } catch (Exception e) {
                    Log.e(TAG, "Error launching app async: " + packageName, e);
                    notifyJavaScript("AppLauncher.onResult", packageName, false, e.getMessage());
                }
            });

            return true; // Returns immediately, result via callback
        }

        @JavascriptInterface
        public boolean isAppInstalled(String packageName) {
            return isAppInstalledInternal(packageName);
        }

        private boolean isAppInstalledInternal(String packageName) {
            try {
                PackageManager pm = getPackageManager();
                PackageInfo info = pm.getPackageInfo(packageName, 0);
                Log.d(TAG, "App found: " + packageName + " version: " + info.versionName);
                return true;
            } catch (PackageManager.NameNotFoundException e) {
                Log.d(TAG, "App not found: " + packageName);
                return false;
            }
        }

        @JavascriptInterface
        public String getAppVersion(String packageName) {
            try {
                PackageInfo info = getPackageManager().getPackageInfo(packageName, 0);
                return info.versionName;
            } catch (PackageManager.NameNotFoundException e) {
                return null;
            }
        }

        @JavascriptInterface
        public boolean openPlayStore(String packageName) {
            Log.d(TAG, "openPlayStore called for: " + packageName);
            try {
                Intent intent = new Intent(Intent.ACTION_VIEW);
                intent.setData(Uri.parse("market://details?id=" + packageName));
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                startActivity(intent);
                return true;
            } catch (Exception e) {
                // Play Store app not available, open in browser
                try {
                    Intent intent = new Intent(Intent.ACTION_VIEW);
                    intent.setData(Uri.parse("https://play.google.com/store/apps/details?id=" + packageName));
                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    startActivity(intent);
                    return true;
                } catch (Exception e2) {
                    Log.e(TAG, "Could not open Play Store for: " + packageName, e2);
                    return false;
                }
            }
        }

        @JavascriptInterface
        public String getPlatform() {
            return "android";
        }

        @JavascriptInterface
        public boolean openFile(String fileUri, String mimeType) {
            Log.d(TAG, "openFile called with URI: " + fileUri + ", MIME: " + mimeType);

            final boolean[] result = {false};
            final Object lock = new Object();

            runOnUiThread(() -> {
                try {
                    File file = null;

                    // Convert Capacitor file URI to a File object
                    if (fileUri.startsWith("file://")) {
                        file = new File(Uri.parse(fileUri).getPath());
                    } else if (fileUri.startsWith("/")) {
                        file = new File(fileUri);
                    } else if (fileUri.startsWith("content://")) {
                        // Already a content URI, open directly
                        Intent intent = new Intent(Intent.ACTION_VIEW);
                        intent.setDataAndType(Uri.parse(fileUri), mimeType);
                        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                        startActivity(intent);
                        Log.d(TAG, "Opened content URI directly");
                        synchronized (lock) {
                            result[0] = true;
                            lock.notify();
                        }
                        return;
                    }

                    if (file != null && file.exists()) {
                        Uri contentUri = FileProvider.getUriForFile(
                            MainActivity.this,
                            getApplicationContext().getPackageName() + ".fileprovider",
                            file
                        );

                        Intent intent = new Intent(Intent.ACTION_VIEW);
                        intent.setDataAndType(contentUri, mimeType);
                        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                        startActivity(intent);
                        Log.d(TAG, "Opened file via FileProvider: " + contentUri);
                        synchronized (lock) {
                            result[0] = true;
                            lock.notify();
                        }
                    } else {
                        Log.w(TAG, "File not found: " + fileUri);
                        synchronized (lock) {
                            result[0] = false;
                            lock.notify();
                        }
                    }
                } catch (Exception e) {
                    Log.e(TAG, "Error opening file: " + e.getMessage(), e);
                    synchronized (lock) {
                        result[0] = false;
                        lock.notify();
                    }
                }
            });

            synchronized (lock) {
                try {
                    lock.wait(3000);
                } catch (InterruptedException e) {
                    Log.e(TAG, "Interrupted while waiting for file open");
                }
            }

            return result[0];
        }

        private void notifyJavaScript(String callback, String packageName, boolean success, String message) {
            // Use AppLauncherCallbacks to avoid shadowing the Java bridge
            String js = String.format(
                "if (window.AppLauncherCallbacks && window.AppLauncherCallbacks.onResult) { window.AppLauncherCallbacks.onResult('%s', %b, '%s'); }",
                packageName, success, message
            );
            runOnUiThread(() -> {
                webView.evaluateJavascript(js, null);
            });
        }
    }
}
