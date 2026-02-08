---
name: mobile-build
description: Build and sync Capacitor Android APK. Use when user says "build apk", "sync android", "mobile build", or "prepare for android studio".
---

# Mobile Build

Build the Capacitor Android app by running the build script and syncing assets.

## Steps

1. **Run the build script** to copy frontend files to www/:
   ```bash
   cd frontend && node build.js
   ```

2. **Sync with Android project**:
   ```bash
   cd frontend && npx cap sync android
   ```

3. **Report completion** and remind user to:
   - Open Android Studio
   - Build → Clean Project
   - Build → Rebuild Project
   - Build → Build APK(s)

## When to Use

- After editing any frontend JavaScript file
- After editing HTML or CSS
- Before testing on Android device
- When user asks to "build the APK" or "sync android"

## Notes

- The build script is at `frontend/build.js`
- It copies files to `frontend/www/` folder
- Capacitor sync copies www/ to Android assets
- Always do Clean + Rebuild in Android Studio for Java changes
