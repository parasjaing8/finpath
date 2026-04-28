# Finpath -- Build & Deploy

**Last updated:** 2026-04-11

---

## Release signing credentials

| Field | Value |
|---|---|
| Keystore file | `~/finpath/android/app/finpath-release.jks` |
| Key alias | `finpath-key` |
| Store password | `Finpath@2026` |
| Key password | `Finpath@2026` |
| Created | 2026-04-09 |
| Valid | 10,000 days |

`~/finpath/android/keystore.properties` (gitignored, Mac mini only):
```
storeFile=app/finpath-release.jks
storePassword=Finpath@2026
keyAlias=finpath-key
keyPassword=Finpath@2026
```

---

## Standard release build

```bash
ssh parasjain@192.168.0.130 << 'EOF'
export PATH="/opt/homebrew/bin:$PATH"
export JAVA_HOME="/opt/homebrew/opt/openjdk@17"
export PATH="$JAVA_HOME/bin:$PATH"
export ANDROID_HOME="$HOME/Library/Android/sdk"
cd ~/finpath/android && ./gradlew assembleRelease
EOF
```

APK at: `~/finpath/android/app/build/outputs/apk/release/app-release.apk` (~54 MB)

---

## Clean build (after native dep or plugin changes)

```bash
ssh parasjain@192.168.0.130 << 'EOF'
export PATH="/opt/homebrew/bin:$PATH"
export JAVA_HOME="/opt/homebrew/opt/openjdk@17"
export PATH="$JAVA_HOME/bin:$PATH"
export ANDROID_HOME="$HOME/Library/Android/sdk"
cd ~/finpath

rm -rf android
npx expo prebuild --platform android

# Fix signingConfig line (plugin patches signingConfigs block but not buildTypes line)
sed -i "" \
  "s/signingConfig signingConfigs\.debug$/signingConfig keystorePropertiesFile.exists() ? signingConfigs.release : signingConfigs.debug/" \
  android/app/build.gradle

cd android && ./gradlew assembleRelease
EOF
```

---

## Copy APK to Dropbox

```bash
ssh parasjain@192.168.0.130 \
  "cp ~/finpath/android/app/build/outputs/apk/release/app-release.apk \
   /Volumes/Dropbox/Finpath/FinPath-v1.0.1-rN.apk"
```

---

## Versioning convention

- `app.json` -> `version` (semver display) + `android.versionCode` (integer, increments each release)
- APK filename: `FinPath-v{version}-r{N}.apk` where N is sequential build number
- Current: v1.0.1 / versionCode 2 / last built = r13 / latest commit = eb1fdcb (r14 not yet built)

---

## ABI -- always check before building

`android/gradle.properties` must contain `reactNativeArchitectures=arm64-v8a`. After `expo prebuild --clean` this can revert to all 4 ABIs, producing a ~150MB APK instead of ~54MB.

```bash
ssh parasjain@192.168.0.130 'grep reactNativeArchitectures ~/finpath/android/gradle.properties'
```

---

## Critical don'ts

- **Never** use `-Pandroid.injected.build.abi=arm64-v8a` -- sets `testOnly=true`, breaks sideloading
- **Never** use `eas build` -- requires interactive auth, does not work over SSH
- **Never** copy from `intermediates/` -- use `outputs/apk/release/`
- **Never** run prebuild without checking if `android/` exists first -- `--clean` deletes keystore.properties

---

## Checking if APK is properly signed

```bash
ssh parasjain@192.168.0.130 \
  "~/Library/Android/sdk/build-tools/*/apksigner verify --verbose \
   ~/finpath/android/app/build/outputs/apk/release/app-release.apk 2>&1 | head -5"
```
