package com.expensetracker.app;

import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.PackageInfo;
import android.os.Bundle;
import android.util.Log;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    private static final String TAG = "ExpenseTracker";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Add JavaScript interface for opening apps
        WebView webView = getBridge().getWebView();
        webView.addJavascriptInterface(new AppLauncher(), "AppLauncher");
        Log.d(TAG, "AppLauncher JavaScript interface registered");
    }

    // JavaScript interface to launch Android apps
    public class AppLauncher {

        @JavascriptInterface
        public boolean openApp(String packageName) {
            Log.d(TAG, "openApp called with package: " + packageName);
            try {
                PackageManager pm = getPackageManager();

                // First check if the app is installed
                if (!isAppInstalled(packageName)) {
                    Log.w(TAG, "App not installed: " + packageName);
                    return false;
                }

                // Get the launch intent for the package
                Intent intent = pm.getLaunchIntentForPackage(packageName);
                if (intent != null) {
                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP);
                    Log.d(TAG, "Launching app: " + packageName);
                    startActivity(intent);
                    return true;
                } else {
                    Log.w(TAG, "Could not get launch intent for: " + packageName);
                    return false;
                }
            } catch (Exception e) {
                Log.e(TAG, "Error launching app: " + packageName, e);
                return false;
            }
        }

        @JavascriptInterface
        public boolean isAppInstalled(String packageName) {
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
    }
}
