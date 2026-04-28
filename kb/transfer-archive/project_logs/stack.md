# Finpath -- Tech Stack

**Last updated:** 2026-04-11

---

## Core

| Layer | Technology |
|---|---|
| Framework | React Native 0.81.5 |
| Expo | SDK 54 (managed+bare hybrid) |
| React | 19.1.0 |
| Routing | Expo Router (file-based, tabs) |
| UI library | React Native Paper (Material Design 3) |
| Database | expo-sqlite (local, no backend) |
| Auth | expo-secure-store + expo-local-authentication |
| Charts | Victory Native + @shopify/react-native-skia |
| Sliders | @miblanchard/react-native-slider |
| Icons | @expo/vector-icons (MaterialCommunityIcons) |
| IAP | react-native-iap (Google Play Billing) |
| Crash reporting | @sentry/react-native (inactive -- no DSN configured) |
| Export | expo-file-system + expo-sharing |
| Language | TypeScript ~5.9 |
| Testing | jest + ts-jest |
| Linting | eslint + prettier |

## Build

| Tool | Version/Notes |
|---|---|
| Java | OpenJDK 17 (Homebrew) |
| Android SDK | via Android Studio / ANDROID_HOME |
| Gradle | via android/gradlew (auto-managed) |
| Node | via Homebrew on Mac mini |
| Expo CLI | npx expo (no global install needed) |

## Expo config plugins

```json
"plugins": [
  "expo-sqlite",
  "expo-router",
  "./plugins/withReleaseSigning"
]
```

`withReleaseSigning` injects keystore.properties loader into build.gradle. Idempotent -- checks for `keystorePropertiesFile` string before inserting. Step-3 regex (buildTypes signingConfig) is broken -- requires manual sed after clean prebuild.

## Android specifics

- **Package name:** `com.anonymous.finpath` (do NOT change -- breaks upgrades)
- **Version:** 1.0.1 / versionCode 2
- **Target ABI:** `arm64-v8a` (set in `android/gradle.properties`: `reactNativeArchitectures=arm64-v8a`)
- **Signing:** release keystore at `~/finpath/android/app/finpath-release.jks`
- **New Architecture:** enabled (`newArchEnabled: true` in app.json)
- **R8/minification:** disabled (APK ~54MB)
- **Permissions in manifest:** INTERNET, READ/WRITE_EXTERNAL_STORAGE (stale), SYSTEM_ALERT_WINDOW (stale), USE_BIOMETRIC, USE_FINGERPRINT, VIBRATE
