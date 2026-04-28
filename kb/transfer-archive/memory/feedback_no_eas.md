---
name: No EAS builds
description: Never use eas build or eas CLI for Android builds — use expo prebuild + Gradle instead
type: feedback
---

Never use `eas build` or any EAS CLI commands for building the app.

**Why:** EAS requires interactive login even for local builds, which breaks non-interactive SSH sessions. The Mac mini build machine can't authenticate EAS without a manual login step each session.

**How to apply:** Always build using this exact command over SSH:
```bash
ssh parasjain@192.168.0.130 'export PATH="/opt/homebrew/bin:$PATH" && export JAVA_HOME="/opt/homebrew/opt/openjdk@17" && export PATH="$JAVA_HOME/bin:$PATH" && export ANDROID_HOME="$HOME/Library/Android/sdk" && cd ~/finpath/android && ./gradlew assembleRelease'
```
APK output: `~/finpath/android/app/build/outputs/apk/release/app-release.apk` (~54 MB, signed, arm64-v8a)

**CRITICAL rules:**
- NEVER use `-Pandroid.injected.build.abi=arm64-v8a` — this is an Android Studio debug shortcut that sets `testOnly=true` and breaks sideloading
- ABI is controlled via `android/gradle.properties`: `reactNativeArchitectures=arm64-v8a`
- Signed APK goes to `outputs/apk/release/`, unsigned intermediate goes to `intermediates/apk/release/` — always use `outputs/`
- After `expo prebuild --clean`, re-run `sed` to fix signingConfig in build.gradle (plugin sets signingConfigs.release block but sed must fix buildTypes.release line)

If native deps changed (new packages), run prebuild first (no --clean to preserve keystore):
```bash
ssh parasjain@192.168.0.130 'export PATH="/opt/homebrew/bin:$PATH" && cd ~/finpath && npx expo prebuild --platform android'
```
Then fix signing: `sed -i "" "s/signingConfig signingConfigs\.debug$/signingConfig keystorePropertiesFile.exists() ? signingConfigs.release : signingConfigs.debug/" ~/finpath/android/app/build.gradle`

For GitHub Actions CI: use the same prebuild + Gradle approach, not `eas build`.
