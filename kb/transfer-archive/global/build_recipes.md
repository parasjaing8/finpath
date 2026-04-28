# Build Recipes

Reusable, copy-paste build commands. All run on Mac mini via SSH.

---

## Expo / React Native — Android Release APK

### Full clean build (after plugin or native dep changes)

```bash
ssh parasjain@192.168.0.130 << 'EOF'
export PATH="/opt/homebrew/bin:$PATH"
export JAVA_HOME="/opt/homebrew/opt/openjdk@17"
export PATH="$JAVA_HOME/bin:$PATH"
export ANDROID_HOME="$HOME/Library/Android/sdk"

cd ~/finpath

# 1. Clean prebuild (regenerates android/ from scratch)
rm -rf android
npx expo prebuild --platform android

# 2. Fix signingConfig (plugin sets the block but not the buildTypes line)
sed -i "" "s/signingConfig signingConfigs\.debug$/signingConfig keystorePropertiesFile.exists() ? signingConfigs.release : signingConfigs.debug/" android/app/build.gradle

# 3. Build
cd android && ./gradlew assembleRelease

echo "APK: $(find . -name 'app-release.apk' -path '*/outputs/*')"
EOF
```

### Incremental build (JS/TS changes only, no native changes)

```bash
ssh parasjain@192.168.0.130 << 'EOF'
export PATH="/opt/homebrew/bin:$PATH"
export JAVA_HOME="/opt/homebrew/opt/openjdk@17"
export PATH="$JAVA_HOME/bin:$PATH"
export ANDROID_HOME="$HOME/Library/Android/sdk"
cd ~/finpath/android && ./gradlew assembleRelease
EOF
```

### Copy APK to Dropbox

```bash
ssh parasjain@192.168.0.130 \
  "cp ~/finpath/android/app/build/outputs/apk/release/app-release.apk \
   /Volumes/Dropbox/Finpath/FinPath-v1.0.1-rN.apk"
```

Replace `rN` with the actual release number.

---

## Expo — prebuild only (no build, for checking generated files)

```bash
ssh parasjain@192.168.0.130 << 'EOF'
export PATH="/opt/homebrew/bin:$PATH"
cd ~/finpath
npx expo prebuild --platform android
EOF
```

---

## ABI check (do this before every build)

`gradle.properties` must have `arm64-v8a` only — if set to all 4 ABIs, APK is ~150MB instead of ~54MB.

```bash
ssh parasjain@192.168.0.130 'grep reactNativeArchitectures ~/finpath/android/gradle.properties'
# Must output: reactNativeArchitectures=arm64-v8a

# Fix if wrong:
ssh parasjain@192.168.0.130 "sed -i '' 's/reactNativeArchitectures=.*/reactNativeArchitectures=arm64-v8a/' ~/finpath/android/gradle.properties"
```

Note: `expo prebuild --clean` regenerates `gradle.properties` from scratch — always check ABI after a clean prebuild.

---

## Android — check keystore

```bash
ssh parasjain@192.168.0.130 \
  "keytool -list -v -keystore ~/finpath/android/app/finpath-release.jks \
   -alias finpath-key -storepass 'Finpath@2026' 2>/dev/null | grep -E 'Alias|Valid|SHA'"
```

---

## Git — standard commit + push from Mac mini

```bash
ssh parasjain@192.168.0.130 << 'EOF'
cd ~/finpath
git add -p                     # review changes interactively
git commit -m "feat: <message>"
git push
EOF
```

---

## Ollama — quick inference on Mac mini

```bash
ssh parasjain@192.168.0.130 'echo "your prompt" | ollama run qwen3'
```
