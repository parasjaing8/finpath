---
name: Release Keystore
description: Android release signing keystore details for FinPath — corrected 2026-04-12
type: project
originSessionId: 3ad0574f-f1b9-4617-8372-bae221188f58
---
Release keystore lives on Mac mini only (never committed to git).

**File:** `~/finpath/finpath-release.jks` (project root — NOT inside android/)
**Alias:** `finpath`
**Password (store + key):** `Paras@iisc18`

**Credentials file:** `~/finpath/android/keystore.properties` (gitignored)

**Correct keystore.properties contents:**
```
storeFile=/Users/parasjain/finpath/finpath-release.jks
storePassword=Paras@iisc18
keyAlias=finpath
keyPassword=Paras@iisc18
```

**Why:** Absolute path required — relative path `../finpath-release.jks` resolves relative to `android/app/` (not `android/`), so Gradle looks in the wrong directory and fails with "keystore not found".

**How to apply:** `withReleaseSigning.js` reads `keystore.properties` at build time. However the plugin's step-3 regex is broken — it does NOT fix the `signingConfig` in the release buildType. Must manually fix after every `expo prebuild --clean`:
```python
python3 -c "
content = open('/Users/parasjain/finpath/android/app/build.gradle').read()
import re
fixed = re.sub(r'(release\s*\{[^}]*)signingConfigs\.debug', r'\1signingConfigs.release', content, flags=re.DOTALL)
open('/Users/parasjain/finpath/android/app/build.gradle', 'w').write(fixed)
"
```

**IMPORTANT — keystore.properties is wiped after every `expo prebuild --clean`**
Must recreate it manually before every build.

**Previous wrong values (do not use):**
- ~~File: `~/finpath/android/app/finpath-release.jks`~~ ← wrong path
- ~~Alias: `finpath-key`~~ ← wrong alias
- ~~Password: `Finpath@2026` / `FinPath@2026`~~ ← wrong password
