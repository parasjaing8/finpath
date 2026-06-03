#!/bin/bash
# Usage: bash scripts/release-apk.sh
# Creates a GitHub release with the latest APK attached.
# Download link: https://github.com/parasjaing8/finpath/releases/latest

set -e

APK_DIR="android/app/build/outputs/apk/release"
APK="$APK_DIR/app-release.apk"

if [ ! -f "$APK" ]; then
  echo "No APK found at $APK — build first."
  exit 1
fi

# Read versionCode from build.gradle
VERSION_CODE=$(grep "versionCode" android/app/build.gradle | grep -v "//" | awk '{print $2}' | head -1)
VERSION_NAME=$(grep "versionName" android/app/build.gradle | grep -v "//" | awk '{print $2}' | tr -d '"' | head -1)
TAG="v${VERSION_NAME}-vc${VERSION_CODE}"

# Copy to versioned filename for the release asset
VERSIONED="$APK_DIR/FinPath-${TAG}.apk"
cp "$APK" "$VERSIONED"

echo "Creating release $TAG..."
gh release create "$TAG" \
  "$VERSIONED#FinPath ${VERSION_NAME} (build ${VERSION_CODE})" \
  --repo parasjaing8/finpath \
  --title "FinPath ${VERSION_NAME} — build ${VERSION_CODE}" \
  --notes "$(cat <<NOTES
## FinPath ${VERSION_NAME} (versionCode ${VERSION_CODE})

Branch: $(git branch --show-current)
Commit: $(git log --oneline -1)

### Install
Download the APK file below and open it on your Android device.
Enable "Install from unknown sources" if prompted.
NOTES
)" \
  --latest

echo ""
echo "Release URL: https://github.com/parasjaing8/finpath/releases/tag/$TAG"
echo "Direct APK:  https://github.com/parasjaing8/finpath/releases/download/$TAG/FinPath-${TAG}.apk"
