# Android App Build Guide

This guide will help you build the Expense Tracker as a native Android app using Capacitor.

## Prerequisites

1. **Node.js** (v18 or higher) - You already have this
2. **Android Studio** - Download from [developer.android.com/studio](https://developer.android.com/studio)
3. **Java JDK 17** - Usually comes with Android Studio

## Step 1: Install Android Studio

1. Download Android Studio from the official website
2. Run the installer and follow the prompts
3. During installation, make sure to install:
   - Android SDK
   - Android SDK Platform-Tools
   - Android Virtual Device (AVD)

4. After installation, open Android Studio and go to:
   - **Settings** → **Appearance & Behavior** → **System Settings** → **Android SDK**
   - Install **Android 14 (API 34)** or the latest version
   - Go to **SDK Tools** tab and install:
     - Android SDK Build-Tools
     - Android SDK Command-line Tools
     - Android Emulator

## Step 2: Set Up Environment Variables

Add these to your system environment variables:

```
ANDROID_HOME = C:\Users\<YourUsername>\AppData\Local\Android\Sdk
Path += %ANDROID_HOME%\platform-tools
Path += %ANDROID_HOME%\tools
```

## Step 3: Install Dependencies

Open a terminal in the `frontend` folder and run:

```bash
cd "C:\Users\chath\OneDrive\Documents\Python code\expense tracker\frontend"
npm install
```

## Step 4: Initialize Capacitor (if not already done)

```bash
npx cap init "Expense Tracker" com.expensetracker.app --web-dir .
```

## Step 5: Add Android Platform

```bash
npx cap add android
```

This creates an `android` folder with the native Android project.

## Step 6: Sync Web Files to Android

```bash
npx cap sync android
```

Run this every time you make changes to your web files.

## Step 7: Open in Android Studio

```bash
npx cap open android
```

This opens the project in Android Studio.

## Step 8: Configure App Icon

Replace the default icons in:
- `android/app/src/main/res/mipmap-mdpi/ic_launcher.png` (48x48)
- `android/app/src/main/res/mipmap-hdpi/ic_launcher.png` (72x72)
- `android/app/src/main/res/mipmap-xhdpi/ic_launcher.png` (96x96)
- `android/app/src/main/res/mipmap-xxhdpi/ic_launcher.png` (144x144)
- `android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png` (192x192)

You can use the SVG icons in `frontend/icons/` and convert them to PNG.

## Step 9: Build APK (Debug)

In Android Studio:
1. Go to **Build** → **Build Bundle(s) / APK(s)** → **Build APK(s)**
2. Wait for the build to complete
3. Find the APK at: `android/app/build/outputs/apk/debug/app-debug.apk`

## Step 10: Build APK (Release - for Play Store)

### Generate a Signing Key (One-time)

```bash
keytool -genkey -v -keystore expense-tracker-release.keystore -alias expense-tracker -keyalg RSA -keysize 2048 -validity 10000
```

Save this keystore file safely! You'll need it for all future updates.

### Configure Signing in Android Studio

1. Go to **Build** → **Generate Signed Bundle / APK**
2. Select **APK**
3. Choose your keystore file
4. Enter the passwords
5. Select **release** build variant
6. Click **Create**

The signed APK will be in `android/app/release/`

## Step 11: Test on Device

### Using USB Debugging:
1. Enable **Developer Options** on your Android phone
2. Enable **USB Debugging**
3. Connect phone via USB
4. In Android Studio, select your device from the dropdown
5. Click **Run** (green play button)

### Using APK:
1. Transfer the APK to your phone
2. Enable "Install from Unknown Sources" in settings
3. Open the APK file to install

## Troubleshooting

### "SDK location not found"
Create a `local.properties` file in the `android` folder:
```
sdk.dir=C:\\Users\\<YourUsername>\\AppData\\Local\\Android\\Sdk
```

### "Gradle sync failed"
- Go to **File** → **Sync Project with Gradle Files**
- Or **File** → **Invalidate Caches / Restart**

### "JAVA_HOME not set"
Add to environment variables:
```
JAVA_HOME = C:\Program Files\Android\Android Studio\jbr
```

## Quick Commands Reference

```bash
# Install dependencies
npm install

# Sync changes to Android
npx cap sync android

# Open in Android Studio
npx cap open android

# Run on connected device (from command line)
npx cap run android

# Build debug APK (from command line)
cd android && ./gradlew assembleDebug
```

## App Configuration

Edit `capacitor.config.ts` to change:
- **appId**: Package name (e.g., com.yourname.expensetracker)
- **appName**: Display name on phone
- **server.url**: Your web app URL (or remove for offline mode)

## Production Mode (Offline)

For a fully offline app, remove the `server` block from `capacitor.config.ts`:

```typescript
const config: CapacitorConfig = {
  appId: 'com.expensetracker.app',
  appName: 'Expense Tracker',
  webDir: '.',
  // server block removed - uses local files
  plugins: {
    // ... same as before
  }
};
```

Then run `npx cap sync android` again.
