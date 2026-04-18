# Emulation Handbook — FinPath Android Testing

> **Purpose:** Step-by-step guide for any LLM/session to programmatically test FinPath on Android emulator.  
> **Last verified:** 2026-04-19, branch `beyond24pro`, commit `b7cdb7c`.  
> **Emulator:** `Medium_Phone_API_36.0` (API 36, arm64, 1080×2400 display)

---

## Table of Contents

1. [Quick Start (Copy-Paste Sequence)](#1-quick-start)
2. [Environment Setup](#2-environment-setup)
3. [Build Debug APK](#3-build-debug-apk)
4. [Install on Emulator](#4-install-on-emulator)
5. [Start Metro + Launch App](#5-start-metro--launch-app)
6. [Navigate & Interact (ADB Automation)](#6-navigate--interact)
7. [UI Inspection & Coordinates](#7-ui-inspection--coordinates)
8. [Screenshot Verification](#8-screenshot-verification)
9. [Known Pitfalls & Solutions](#9-known-pitfalls--solutions)
10. [Coordinate Reference](#10-coordinate-reference)
11. [Keyboard Testing Specifics](#11-keyboard-testing-specifics)

---

## 1. Quick Start

Minimal sequence assuming emulator is already running:

```bash
# 1. Set env vars (run once per terminal)
export ANDROID_HOME="$HOME/Library/Android/sdk"
export ADB="$ANDROID_HOME/platform-tools/adb"
export PATH="/opt/homebrew/bin:$PATH"
export JAVA_HOME="/opt/homebrew/opt/openjdk@17"
export PATH="$JAVA_HOME/bin:$PATH"

# 2. Build debug APK
cd ~/finpath/android && ./gradlew assembleDebug 2>&1 | tail -8

# 3. Uninstall existing (avoid signature conflict) + install
"$ADB" shell pm uninstall com.aihomecloud.finpath
"$ADB" install ~/finpath/android/app/build/outputs/apk/debug/app-debug.apk

# 4. Set up port forwarding
"$ADB" reverse tcp:8081 tcp:8081

# 5. Start Metro (in a separate async terminal)
cd ~/finpath && npx expo start --dev-client --port 8081

# 6. Launch app via deep link
"$ADB" shell am start -a android.intent.action.VIEW \
  -d "finpath://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8081" \
  com.aihomecloud.finpath/.MainActivity

# 7. Wait for bundle to load (~5-8 seconds)
sleep 8

# 8. Take screenshot to verify
"$ADB" shell screencap -p /sdcard/screen.png && "$ADB" pull /sdcard/screen.png /tmp/screen.png
```

---

## 2. Environment Setup

### Required env vars (every terminal session)

```bash
export ANDROID_HOME="$HOME/Library/Android/sdk"
export ADB="$ANDROID_HOME/platform-tools/adb"
export PATH="/opt/homebrew/bin:$PATH"
export JAVA_HOME="/opt/homebrew/opt/openjdk@17"
export PATH="$JAVA_HOME/bin:$PATH"
```

### Check emulator status

```bash
"$ADB" devices
# Expected: emulator-5554   device
```

### Start emulator (if not running)

```bash
$ANDROID_HOME/emulator/emulator -avd Medium_Phone_API_36.0 -no-snapshot-load &
# Wait ~30 seconds for boot. Check with:
"$ADB" shell getprop sys.boot_completed
# Returns "1" when ready
```

**Headless (no GUI window):**
```bash
$ANDROID_HOME/emulator/emulator -avd Medium_Phone_API_36.0 -no-window -no-audio -no-snapshot-load &
```

---

## 3. Build Debug APK

```bash
cd ~/finpath/android && ./gradlew assembleDebug 2>&1 | tail -8
```

**Output APK path:** `~/finpath/android/app/build/outputs/apk/debug/app-debug.apk`

**Build time:** ~15-30 seconds (incremental), ~60-90 seconds (clean)

### PITFALL: Build after `expo prebuild --clean`
After a clean prebuild, the `signingConfig` line in `android/app/build.gradle` resets. For release builds only, you'd need the sed fix. Debug builds don't need this.

---

## 4. Install on Emulator

### CRITICAL: Always uninstall first if switching between release and debug

```bash
# Uninstall existing (prevents INSTALL_FAILED_UPDATE_INCOMPATIBLE)
"$ADB" shell pm uninstall com.aihomecloud.finpath

# Install debug APK
"$ADB" install ~/finpath/android/app/build/outputs/apk/debug/app-debug.apk
```

### PITFALL: INSTALL_FAILED_UPDATE_INCOMPATIBLE
**Cause:** A release-signed APK is installed but you're trying to install a debug-signed APK (or vice versa). Different signing keys = Android refuses the update.  
**Fix:** `"$ADB" shell pm uninstall com.aihomecloud.finpath` then install fresh.  
**Side effect:** App data (profiles, settings) is lost. You must re-create a test profile.

### PITFALL: INSTALL_FAILED_INSUFFICIENT_STORAGE
**Cause:** Emulator internal storage is full (often >85%).  
**Diagnosis:**
```bash
"$ADB" shell df /data | tail -1
```
**Fix:** Remove unused packages:
```bash
"$ADB" shell pm uninstall com.anonymous.finpath   # old package name
"$ADB" shell pm uninstall com.parasjain.finpath    # old package name
"$ADB" shell pm clear com.android.chrome
"$ADB" shell rm -rf /data/local/tmp/*
```
List third-party packages to find more:
```bash
"$ADB" shell pm list packages -3
```

---

## 5. Start Metro + Launch App

### Step 1: Port forwarding

```bash
"$ADB" reverse tcp:8081 tcp:8081
```

This allows the emulator to reach `localhost:8081` (Metro) on the host machine.

### Step 2: Start Metro (async terminal — keeps running)

```bash
cd ~/finpath && npx expo start --dev-client --port 8081
```

**CRITICAL:** Use `--dev-client`, NOT `--android`. The `--android` flag tries to open Expo Go, which doesn't have the native modules (react-native-iap NitroModules). The debug APK already has native modules baked in — it just needs Metro to serve the JS bundle.

### Step 3: Launch app via deep link

```bash
"$ADB" shell am start -a android.intent.action.VIEW \
  -d "finpath://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8081" \
  com.aihomecloud.finpath/.MainActivity
```

**Wait 5-8 seconds** for the JS bundle to load (Metro terminal will show "iOS Bundling complete" or similar).

### PITFALL: "Unable to load script" red screen
**Cause:** Metro is not running, or `adb reverse` wasn't set up.  
**Fix:** Ensure Metro is running on port 8081 and `adb reverse tcp:8081 tcp:8081` was executed.

### PITFALL: App opens Expo Go instead of debug build
**Cause:** Used `npx expo start --android` instead of `--dev-client`. Or the deep link scheme isn't registered.  
**Fix:** Use `--dev-client` flag. Launch via the explicit deep link intent above, not through Expo's auto-launch.

### PITFALL: IAP init error overlay on launch
**Cause:** `react-native-iap` tries to connect to Google Play billing but emulator has no Play account.  
**Nature:** Non-fatal. App UI loads behind the error overlay.  
**Fix:** Dismiss it. Find and tap the "Dismiss" button:
```bash
"$ADB" shell uiautomator dump /sdcard/ui.xml >/dev/null && "$ADB" pull /sdcard/ui.xml /tmp/ui.xml >/dev/null
python3 -c "
import re
xml = open('/tmp/ui.xml').read()
for m in re.finditer(r'<node[^>]*text=\"([^\"]*)\"[^>]*bounds=\"\[(\d+),(\d+)\]\[(\d+),(\d+)\]\"', xml):
    if 'Dismiss' in m.group(1):
        x = (int(m.group(2))+int(m.group(4)))//2
        y = (int(m.group(3))+int(m.group(5)))//2
        print(f'Dismiss at ({x},{y})')
"
# Then tap: "$ADB" shell input tap <x> <y>
```
There may be **multiple** error overlays stacked. Keep tapping Dismiss until they're all gone. Typical position: `(269, 2273)`.

### Hot Reload

After code changes, send "r" to the Metro terminal to trigger a reload. No need to rebuild the APK for JS-only changes.

```bash
# If Metro is in terminal ID $METRO_ID:
send "r" to that terminal
# Or use adb:
"$ADB" shell input keyevent 82  # Opens dev menu
# Then tap "Reload"
```

---

## 6. Navigate & Interact

### ADB Input Commands

| Action | Command |
|---|---|
| Tap at coordinates | `"$ADB" shell input tap <x> <y>` |
| Type text | `"$ADB" shell input text "<text>"` |
| Press Back | `"$ADB" shell input keyevent 4` |
| Press Home | `"$ADB" shell input keyevent 3` |
| Press Enter | `"$ADB" shell input keyevent 66` |
| Dismiss keyboard | `"$ADB" shell input keyevent 4` |
| Swipe/scroll | `"$ADB" shell input swipe <x1> <y1> <x2> <y2> <duration_ms>` |
| Scroll down | `"$ADB" shell input swipe 540 1500 540 500 300` |
| Scroll up | `"$ADB" shell input swipe 540 500 540 1500 300` |

### PITFALL: Comments in shell commands
**Never** use `#` comments in the middle of `&&` chains when running via `run_in_terminal`. Zsh interprets `#` as a command, causing `command not found` errors.

**BAD:**
```bash
# Dismiss error and login
"$ADB" shell input tap 540 1315
```

**GOOD:**
```bash
"$ADB" shell input tap 540 1315
```

### Creating a Test Profile (after fresh install)

The app starts on the onboarding/create-profile screen after fresh install.

1. Use UI dump to find field coordinates (they shift between builds)
2. Fill fields: Name → Income → PIN → Confirm PIN
3. Tap "Create Profile"

```bash
# Always get coordinates from UI dump first, don't hardcode
"$ADB" shell uiautomator dump /sdcard/ui.xml >/dev/null
"$ADB" pull /sdcard/ui.xml /tmp/ui.xml >/dev/null
python3 << 'PY'
import re
xml = open('/tmp/ui.xml').read()
for m in re.finditer(r'<node[^>]*class="android\.widget\.EditText"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"', xml):
    x1,y1,x2,y2 = int(m.group(1)),int(m.group(2)),int(m.group(3)),int(m.group(4))
    print(f'EditText at ({(x1+x2)//2},{(y1+y2)//2})')
PY
```

**Test profile used in testing:**
- Name: `Test`
- Income: `50000`
- PIN: `123456`
- Currency: ₹ INR (default)

### Login Flow

```bash
# 1. Find PIN field and Login button
"$ADB" shell uiautomator dump /sdcard/ui.xml >/dev/null && "$ADB" pull /sdcard/ui.xml /tmp/ui.xml >/dev/null
python3 << 'PY'
import re
xml = open('/tmp/ui.xml').read()
for m in re.finditer(r'<node[^>]*text="([^"]*)"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"', xml):
    t = m.group(1)
    if t in ['Login', '6-digit PIN'] or 'EditText' in m.group(0):
        x = (int(m.group(2))+int(m.group(4)))//2
        y = (int(m.group(3))+int(m.group(5)))//2
        print(f'"{t}" at ({x},{y})')
PY

# 2. Tap PIN field, type PIN, tap Login
"$ADB" shell input tap <pin_x> <pin_y>
sleep 0.5
"$ADB" shell input text 123456
sleep 0.5
"$ADB" shell input tap <login_x> <login_y>
sleep 3
```

---

## 7. UI Inspection & Coordinates

### Full UI dump (primary method)

```bash
"$ADB" shell uiautomator dump /sdcard/ui.xml >/dev/null
"$ADB" pull /sdcard/ui.xml /tmp/ui.xml >/dev/null
```

### Parse all text elements with bounds

```python
python3 << 'PY'
import re
xml = open('/tmp/ui.xml').read()
for m in re.finditer(r'<node[^>]*text="([^"]*)"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"', xml):
    t = m.group(1)
    if t and t != 'null':
        x1,y1,x2,y2 = int(m.group(2)),int(m.group(3)),int(m.group(4)),int(m.group(5))
        cx, cy = (x1+x2)//2, (y1+y2)//2
        print(f'"{t}" at ({cx},{cy}) [{x1},{y1}][{x2},{y2}]')
PY
```

### Find specific elements by content-desc (accessibility labels)

```python
python3 << 'PY'
import re
xml = open('/tmp/ui.xml').read()
for m in re.finditer(r'<node[^>]*content-desc="([^"]*)"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"', xml):
    t = m.group(1)
    if t:
        x1,y1,x2,y2 = int(m.group(2)),int(m.group(3)),int(m.group(4)),int(m.group(5))
        print(f'desc="{t}" at ({(x1+x2)//2},{(y1+y2)//2})')
PY
```

### Find EditText fields (input fields)

```python
python3 << 'PY'
import re
xml = open('/tmp/ui.xml').read()
for m in re.finditer(r'<node[^>]*class="android\.widget\.EditText"[^>]*', xml):
    ctx = m.group(0)
    t = re.search(r'text="([^"]*)"', ctx)
    f = re.search(r'focused="([^"]*)"', ctx)
    b = re.search(r'bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"', ctx)
    if t and b:
        print(f'"{t.group(1)}" focused={f.group(1) if f else "?"} y={b.group(2)}-{b.group(4)}')
PY
```

### PITFALL: Don't hardcode coordinates
Coordinates shift between builds, after style changes, and depending on content. **Always** use `uiautomator dump` to get fresh coordinates before interacting.

### PITFALL: Inverted bounds in ScrollView
Inside a `ScrollView`, `uiautomator` may report inverted bounds (y1 > y2) for items that are off-screen or partially visible. These coordinates are unreliable for tapping — scroll to make the item fully visible first.

---

## 8. Screenshot Verification

### Take screenshot

```bash
"$ADB" shell screencap -p /sdcard/screen.png
"$ADB" pull /sdcard/screen.png /tmp/screen.png
```

Then use `view_image` tool to inspect `/tmp/screen.png`.

### PITFALL: Screenshot naming
Use unique names for each screenshot (`/tmp/screenA.png`, `/tmp/screenB.png`, etc.) to avoid confusion when reviewing multiple states.

---

## 9. Known Pitfalls & Solutions

### Critical Issues (will block testing)

| Issue | Symptom | Root Cause | Fix |
|---|---|---|---|
| **Signature conflict** | `INSTALL_FAILED_UPDATE_INCOMPATIBLE` | Release APK installed, trying to install debug (or vice versa) | `adb uninstall com.aihomecloud.finpath` first |
| **No JS bundle** | "Unable to load script" red screen | Metro not running or adb reverse not set | Start Metro with `--dev-client`, run `adb reverse tcp:8081 tcp:8081` |
| **Expo Go interference** | Opens Expo Go instead of custom dev build | Used `expo start --android` instead of `--dev-client` | Use `--dev-client` flag; launch via deep link intent |
| **Storage full** | `INSTALL_FAILED_INSUFFICIENT_STORAGE` | Emulator disk >85% full | Uninstall old packages, clear caches |
| **NitroModules crash** | "NitroModules not found" in Expo Go | Native modules only exist in custom dev build, not Expo Go | Never use Expo Go; use custom debug APK |

### Non-Blocking Issues (can be dismissed)

| Issue | Symptom | Fix |
|---|---|---|
| **IAP init error** | LogBox overlay: "PurchaseError: Failed to initialize connection" | Tap "Dismiss" button (may need to dismiss multiple times) |
| **Dev warning banners** | Yellow/orange banners at bottom covering tab bar | Tap the X buttons to dismiss; positions vary but typically near (996, 2069) and (996, 2209) |

### Interaction Pitfalls

| Issue | Symptom | Fix |
|---|---|---|
| **Stale coordinates** | Taps miss targets after code changes | Always `uiautomator dump` before tapping |
| **Keyboard covers buttons** | Can't tap Save/Cancel with keyboard open | Press Back (`keyevent 4`) to dismiss keyboard first |
| **Modal behind keyboard** | Input field focused but hidden behind keyboard | This was the bug we fixed — `KeyboardProvider` + remove `minHeight:'100%'` |
| **Comments in && chains** | `zsh: command not found: #` | Never use `#` comments in `&&`-chained commands |
| **input text with spaces** | Text gets split at spaces | Use `input text "word1%sword2"` or tap-type character by character |

---

## 10. Coordinate Reference

> **WARNING:** These are approximate and will shift with code/style changes.  
> Always verify with `uiautomator dump`.

### Tab Bar (bottom navigation) — as of 2026-04-19

| Tab | Center Position |
|---|---|
| Assets | (107, 2313) |
| Expenses | (323, 2313) |
| Goal | (539, 2313) |
| Dashboard | (756, 2313) |
| Profile | (971, 2313) |

### FAB (Floating Action Button)

On Assets and Expenses pages: approximately `(954, 2053)`

### IAP Error Dismiss

Dismiss button: approximately `(269, 2273)`  
Minimize button: approximately `(809, 2273)`

### Screen Dimensions

- Resolution: 1080 × 2400 pixels
- Status bar: ~66px top
- Navigation bar: ~96px bottom
- Usable area: ~1080 × 2238

---

## 11. Keyboard Testing Specifics

### What to verify

For any field near the bottom of a modal (below ~y=1500), tapping it should:
1. Bring up the software keyboard
2. **Automatically scroll** the focused field above the keyboard
3. The field should be visible and editable

### How to verify

```bash
# 1. Open modal (tap FAB)
"$ADB" shell input tap 954 2053
sleep 1

# 2. Find the bottom-most input field
"$ADB" shell uiautomator dump /sdcard/ui.xml >/dev/null && "$ADB" pull /sdcard/ui.xml /tmp/ui.xml >/dev/null
# Parse to find field coordinates (see Section 7)

# 3. Tap the field
"$ADB" shell input tap <x> <y>
sleep 1.5  # Wait for keyboard animation

# 4. Screenshot to verify field is above keyboard
"$ADB" shell screencap -p /sdcard/screen.png && "$ADB" pull /sdcard/screen.png /tmp/screen.png

# 5. Check focus state (should show focused=true)
"$ADB" shell uiautomator dump /sdcard/ui.xml >/dev/null && "$ADB" pull /sdcard/ui.xml /tmp/ui.xml >/dev/null
# Parse EditText fields to verify focused=true
```

### Key fields to test

| Page | Modal | Field to test | Default value | Why |
|---|---|---|---|---|
| Assets | Add Asset | Expected Return (%) | `11` | Bottom of form, below scroll fold |
| Expenses | Add Expense | Inflation Rate (%) | `6` | Bottom of form, requires scroll when keyboard opens |

### Architecture: How keyboard handling works

1. **`KeyboardProvider`** (from `react-native-keyboard-controller`) wraps the entire app in [app/_layout.tsx](app/_layout.tsx). This is **required** — without it, `KeyboardAwareScrollView` is inert.

2. **`KeyboardAwareScrollViewCompat`** (in `components/KeyboardAwareScrollViewCompat.tsx`) wraps the modal sheet content. On native it renders `KeyboardAwareScrollView`; on web it falls back to plain `ScrollView`.

3. **Modal sheet style** must NOT use `minHeight: '100%'` — this prevents the scroll view from calculating correct scroll offsets. Use `paddingBottom: 40` instead.

4. **`bottomOffset={20}`** is passed to the scroll view to add padding between the focused field and the keyboard edge.

### Historical bug: Missing KeyboardProvider

**Symptom:** Field shows `focused=true` in UI dump at y=1809, keyboard covers from y~1000 down, but `KeyboardAwareScrollView` doesn't scroll.  
**Root cause:** `KeyboardProvider` was never added to the app root. `react-native-keyboard-controller` v1.18.5 requires it.  
**Fix commit:** `b7cdb7c` — added `KeyboardProvider` to `_layout.tsx`, replaced `minHeight:'100%'` with `paddingBottom: 40` on modal sheets.

---

## Appendix: Complete Test Run Checklist

```
[ ] Emulator running (`adb devices` shows emulator-5554)
[ ] Debug APK built (`./gradlew assembleDebug`)
[ ] Old APK uninstalled (if switching signing keys)
[ ] Debug APK installed
[ ] adb reverse tcp:8081 tcp:8081
[ ] Metro running with --dev-client --port 8081
[ ] App launched via deep link intent
[ ] IAP errors dismissed (may be 2-3 overlays)
[ ] Dev warning banners dismissed
[ ] Profile exists or created (Name: Test, PIN: 123456)
[ ] Logged in
[ ] Test scenario executed
[ ] Screenshots captured and verified
```

---

## Appendix: Useful ADB One-Liners

```bash
# Kill and restart app
"$ADB" shell am force-stop com.aihomecloud.finpath
"$ADB" shell am start -a android.intent.action.VIEW \
  -d "finpath://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8081" \
  com.aihomecloud.finpath/.MainActivity

# Clear app data (like fresh install)
"$ADB" shell pm clear com.aihomecloud.finpath

# Check if keyboard is visible
"$ADB" shell dumpsys input_method | grep mInputShown

# Get current activity
"$ADB" shell dumpsys activity activities | grep mResumedActivity

# List all text on screen (quick overview)
"$ADB" shell uiautomator dump /sdcard/q.xml >/dev/null && "$ADB" pull /sdcard/q.xml /tmp/q.xml >/dev/null && grep -oP 'text="\K[^"]+' /tmp/q.xml | grep -v null | sort -u
```
