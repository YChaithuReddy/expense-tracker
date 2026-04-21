---
tags: [adr, android, build, performance]
date: 2026-04-21
status: accepted
---

# ADR-004: Enable R8 + resource shrink in release builds

## Context

Debug APK is 128 MB. Users on slow mobile connections need a smaller download — in-app update downloads should finish in seconds, not minutes. Flutter offers three build modes (debug / profile / release), but release alone isn't enough — Android R8 and resource shrinking cut another ~40% on top.

## Decision

In `android/app/build.gradle.kts`:
```kotlin
buildTypes {
    release {
        signingConfig = signingConfigs.getByName("debug")
        isMinifyEnabled = true   // R8 code shrinking
        isShrinkResources = true // strip unused drawables/strings
    }
}
```

Build with `flutter build apk --release`.

## Result

| Mode | Size | Notes |
|---|---|---|
| Debug | 128 MB | Includes Dart VM, full symbols, no tree-shake |
| Release (R8 off) | ~100 MB | AOT compiled but still bundles everything |
| **Release (R8 on)** | **50 MB** | Production config we ship |
| arm64-only release | 22 MB | Per-ABI APK, not universal |

61% size reduction from debug → release+R8. Download time on a 10 Mbps connection: ~40s vs ~100s.

## Consequences

**Pros:**
- Faster in-app update downloads (2.5× faster)
- Smaller footprint on device storage
- Better perceived performance (AOT compiled)

**Cons:**
- Obfuscated stack traces in Sentry (need mapping.txt upload for deobfuscation)
- Slightly longer build time (~2 min → ~5 min with R8)

## See also

- [[003-Debug-Signing-For-Updates]]
- [[../10-Code-Context/FluxGen-Release-Workflow]]
