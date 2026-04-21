---
tags: [fluxgen, release, deploy, apk]
created: 2026-04-21
updated: 2026-04-21
---

# FluxGen Release Workflow

End-to-end flow for shipping a new APK to existing users via the in-app update system.

## In-app update mechanism

`UpdateService.checkForUpdate` runs on app start. It queries Supabase `app_config` where `key = 'android_latest'`:
```json
{
  "value": "2.1.0",
  "metadata": {
    "build_number": 24,
    "apk_url": "https://github.com/YChaithuReddy/expense-tracker/releases/download/v2.1.0-flutter/app-release.apk",
    "release_notes": "..."
  }
}
```

If the stored version > installed version, user sees an "Update Available" dialog → download → install.

## Release checklist

1. **Bump version** in two places:
   - `fluxgen_emerald/pubspec.yaml` → `version: 2.1.0+24`
   - `fluxgen_emerald/lib/core/constants/app_constants.dart` → `appVersion = '2.1.0'`
   - `fluxgen_emerald/lib/services/update_service.dart` → `_currentBuildNumber = 24`
2. **Build release APK** — `flutter build apk --release` (50 MB optimized)
3. **Create GitHub release** with tag `v2.1.0-flutter` + upload APK as `app-release.apk`
4. **Update Supabase** `app_config` row with new version + build_number + apk_url
5. **Commit + push** the version bump
6. **Users auto-prompted** on next app open

## Signing gotcha (CRITICAL)

- APK signatures must match across updates, else Android shows "Package appears to be invalid"
- **All production APKs use debug keystore signing** (Flutter's default per-machine keystore)
- `android/app/build.gradle.kts` has `signingConfig = signingConfigs.getByName("debug")` even for release builds
- `fluxgen.jks` exists but not used — switching to it would require every user to uninstall once (data loss)

## Recommended gitignore
```
# commit graph outputs, ignore the extraction cache
graphify-out/cache/
```

## See also
- [[20-Decisions/003-Debug-Signing-For-Updates]]
- [[20-Decisions/004-Release-Optimizations]]
- [[FluxGen-Architecture]]
