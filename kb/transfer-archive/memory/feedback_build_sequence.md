---
name: Android Build Sequence — Post Prebuild
description: Required manual steps after every expo prebuild --clean before gradlew bundleRelease
type: feedback
originSessionId: 3ad0574f-f1b9-4617-8372-bae221188f58
---
After every `expo prebuild --clean`, the android/ folder is wiped. Three things must be manually restored before building:

**Why:** expo prebuild regenerates android/ from scratch. keystore.properties is gitignored (intentionally). withReleaseSigning.js step-3 regex is broken. build.gradle versionCode comes from prebuild defaults, not app.json.

**How to apply:** Run these steps in order before every `./gradlew bundleRelease`:

**Step 1 — Recreate keystore.properties:**
```
storeFile=/Users/parasjain/finpath/finpath-release.jks
storePassword=Paras@iisc18
keyAlias=finpath
keyPassword=Paras@iisc18
```
Note: storeFile MUST be absolute path — relative path resolves to wrong directory.

**Step 2 — Fix versionCode in build.gradle:**
```bash
sed -i '' 's/versionCode N/versionCode M/' ~/finpath/android/app/build.gradle
```

**Step 3 — Fix signingConfig in release buildType:**
```python
python3 -c "
content = open('/Users/parasjain/finpath/android/app/build.gradle').read()
import re
fixed = re.sub(r'(release\s*\{[^}]*)signingConfigs\.debug', r'\1signingConfigs.release', content, flags=re.DOTALL)
open('/Users/parasjain/finpath/android/app/build.gradle', 'w').write(fixed)
"
```

**Step 4 — Verify:**
```bash
grep -n "versionCode\|signingConfig" ~/finpath/android/app/build.gradle
```
Expected: debug block has `signingConfigs.debug`, release block has `signingConfigs.release`.

**Step 5 — Copy AAB to Windows:**
Dropbox is NOT reliably mounted on Mac mini (`/Volumes/Dropbox/` absent in SSH sessions). Use scp FROM Windows to pull the file instead:
```bash
# Run this on Windows, not Mac
scp parasjain@192.168.0.130:~/finpath/android/app/build/outputs/bundle/release/app-release.aab "C:\dropbox\finpath\app-release.aab"
```
