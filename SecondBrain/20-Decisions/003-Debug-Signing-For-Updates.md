---
tags: [adr, android, signing, deploy]
date: 2026-04-21
status: accepted
---

# ADR-003: APKs use debug keystore for seamless in-app updates

## Context

User reported "Package appears to be invalid" when attempting to install v2.1.0 release APK over their installed v2.0.3 debug APK. Android refuses updates when signing keys differ.

Three options:

1. Keep using debug keystore for all "releases" (smaller ecosystem cost)
2. Switch to `fluxgen.jks` (proper release key) — requires all users to uninstall once (loses local data)
3. Dual publish — but impossible, only one install can exist

## Decision

**Use debug keystore** via `signingConfig = signingConfigs.getByName("debug")` in `android/app/build.gradle.kts`, even for release builds. Combine with `isMinifyEnabled = true` + `isShrinkResources = true` for 60% size reduction.

## Consequences

**Pros:**
- Seamless updates — no package-invalid errors
- Users keep their data (SharedPreferences, session, EmpID mapping) across updates
- Still release-optimized (AOT compilation, R8 tree-shaking) → 50 MB APK

**Cons:**
- Debug keystore is tied to THIS machine — if a different developer builds on their machine, updates will fail
- Not production-grade security (debug key is well-known)
- Cannot publish to Play Store this way (Play requires a unique release key)

## When to revisit

When we need to publish to Play Store OR migrate to proper release signing:
1. Generate a new signing key OR reuse `fluxgen.jks`
2. Communicate to users: "next update requires a one-time reinstall"
3. Flip `signingConfig` back to `signingConfigs.getByName("release")`

## See also
- [[../10-Code-Context/FluxGen-Release-Workflow]]
