#!/bin/bash
# Full release pipeline: bump version → build AAB → upload to Play Store
# Usage:
#   bash scripts/release.sh                    # internal track (default)
#   bash scripts/release.sh --track production # production
#   bash scripts/release.sh --notes "Bug fixes and UI improvements"

set -e

TRACK="internal"
NOTES=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --track) TRACK="$2"; shift 2 ;;
    --notes) NOTES="$2"; shift 2 ;;
    *) echo "Unknown arg: $1"; exit 1 ;;
  esac
done

export PATH="/opt/homebrew/bin:$PATH"
export JAVA_HOME="/opt/homebrew/opt/openjdk@17"
export PATH="$JAVA_HOME/bin:$PATH"
export ANDROID_HOME="$HOME/Library/Android/sdk"

echo "=== FinPath Release Pipeline ==="
echo "Track: $TRACK"
echo ""

# 1. Bump versionCode
CURRENT=$(grep "versionCode" android/app/build.gradle | grep -v "//" | awk '{print $2}' | head -1)
NEW=$((CURRENT + 1))
sed -i '' "s/versionCode $CURRENT/versionCode $NEW/" android/app/build.gradle
echo "versionCode: $CURRENT → $NEW"

# 2. Build AAB
echo ""
echo "Building AAB..."
cd android && ./gradlew bundleRelease 2>&1 | grep -E "BUILD|error:" | head -5
cd ..

AAB="android/app/build/outputs/bundle/release/app-release.aab"
if [ ! -f "$AAB" ]; then
  echo "ERROR: AAB not found. Build may have failed."
  exit 1
fi

# Copy versioned AAB
cp "$AAB" "android/app/build/outputs/bundle/release/app-release-v${NEW}.aab"
echo "AAB built: app-release-v${NEW}.aab ($(du -sh "$AAB" | cut -f1))"

# 3. Upload to Play Store
echo ""
echo "Uploading to Play Store ($TRACK)..."
if [ -n "$NOTES" ]; then
  python3 scripts/upload_to_play.py --track "$TRACK" --notes "$NOTES"
else
  python3 scripts/upload_to_play.py --track "$TRACK"
fi

# 4. Commit version bump
echo ""
git add -f android/app/build.gradle
git commit -m "chore: versionCode $NEW — $TRACK release"
git push origin "$(git branch --show-current)"

echo ""
echo "=== Done ==="
echo "versionCode $NEW uploaded to Play Store ($TRACK track)"
echo "Run this to promote to production:"
echo "  python3 scripts/upload_to_play.py --promote $TRACK production"
