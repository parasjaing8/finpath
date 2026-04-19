# FinPath v33 Session Log — 2026-04-19

## Commit

- **Hash:** `d7bd1a0`
- **Branch:** `audit19April`
- **versionCode:** 33
- **versionName:** 1.0.1
- **AAB:** `releases/app-release-v33.aab`

## What Changed

### Bug Fixed: Data persistence across sessions

**Symptom:** Assets, expenses, and goals entered or imported in one session were lost after closing and reopening the app. Profile data (name, DOB, income) persisted fine.

### Root Causes (3 bugs)

#### 1. `syncToAppContext` unconditionally overwrites AsyncStorage from SQLite

- **File:** `app/login.tsx` → `syncToAppContext()`
- **Problem:** Every login reads assets/expenses/goals from SQLite and calls `setAssets()`/`setExpenses()`/`setGoals()`, which write to encrypted AsyncStorage. If SQLite has empty/stale data, it destroys good AsyncStorage data.
- **Fix:** Added check `if (currentProfile?.id === selectedId) return;` — skips SQLite read when the same profile is already loaded from AsyncStorage (loaded by `AppProvider.loadData()`). Only syncs from SQLite when genuinely switching profiles.

#### 2. `importAll` doesn't write to SQLite

- **File:** `context/AppContext.tsx` → `importAll()`
- **Problem:** Imported backup data was written only to encrypted AsyncStorage, not SQLite. On next login, `syncToAppContext` read empty SQLite → overwrote AsyncStorage with `[]` → all imported data lost.
- **Fix:** `importAll` now accepts optional `sqliteProfileId?: number`. When provided, writes each imported asset/expense/goal to SQLite via `dbCreateAsset`/`dbCreateExpense`/`dbSaveGoals`. Asset and expense IDs are remapped to SQLite auto-increment IDs. Updated callers in `create-profile.tsx` and `profile.tsx`.

#### 3. `sha256` passes `ArrayBuffer` to `Crypto.digest` — crashes on Android

- **File:** `storage/secure.ts` → `sha256()`
- **Problem:** The function sliced `Uint8Array.buffer` into a raw `ArrayBuffer` and passed it to `Crypto.digest()`. The Android Kotlin bridge cannot marshal `ArrayBuffer` → throws "Cannot convert '[object ArrayBuffer]' to a Kotlin type". This caused import to fail with a crypto error.
- **Fix:** Pass `Uint8Array` directly to `Crypto.digest()` — the API accepts `BufferSource` (which includes `TypedArray`).

### Files Modified

| File | Change |
|---|---|
| `context/AppContext.tsx` | `importAll` accepts `sqliteProfileId`, writes to SQLite; imports `saveGoals as dbSaveGoals` |
| `app/login.tsx` | `syncToAppContext` skips SQLite overwrite for same profile |
| `app/onboarding/create-profile.tsx` | Passes `profileId` to `importAll` |
| `app/(tabs)/profile.tsx` | Passes `profile.id` to `importAll` (both call sites) |
| `storage/secure.ts` | `sha256()` passes `Uint8Array` instead of `ArrayBuffer` |
| `android/app/build.gradle` | versionCode 32 → 33 |
| `app.json` | versionCode 28 → 33 |

## Verification

- **Tests:** All 70 pass
- **Emulator test (Medium_Phone_API_36.0):**
  1. Clean install → created profile (Name=Test, PIN=123456)
  2. Profile tab → Import → picked `test-backup.json` (1 MF asset ₹41L, 1 expense ₹65K/mo)
  3. Import succeeded (sha256 fix worked — no crypto error)
  4. Assets tab: ₹41.00 L Mutual Fund ✓
  5. Expenses tab: ₹65.0K Monthly ✓
  6. Force-stopped app → restarted
  7. Login screen appeared (profile persisted) ✓
  8. Entered PIN → Assets: ₹41.00 L ✓, Expenses: ₹65.0K ✓
  9. **Data survived session restart** ✓

## Lessons & Notes for Future Sessions

### Architecture: Dual Storage Is the Root of Most Bugs

- **Encrypted AsyncStorage** (AES-256-CBC + HMAC-SHA256) is the primary store, loaded by `AppProvider.loadData()` on mount.
- **SQLite** is the secondary store, used for multi-profile support and profile-switching.
- **Any code path that writes to one store MUST write to both**, or data will be lost on next login when `syncToAppContext` runs.
- When adding new data write paths in the future, always check: "Am I writing to both stores?"

### `syncToAppContext` Is Dangerous

- It runs on every login and can overwrite good AsyncStorage data with stale SQLite data.
- The fix (skip when same profile) is correct but fragile — if someone changes profile ID format or comparison logic, this can break again.
- **Long-term fix:** Consider making AsyncStorage the single source of truth and only using SQLite for profile metadata (name, pin hash, biometric flag). This eliminates the dual-store sync problem entirely.

### expo-crypto `Crypto.digest()` Expects TypedArray on Android

- The JS API says it accepts `BufferSource` (ArrayBuffer | TypedArray), but the **Android Kotlin native module can only marshal TypedArray** (specifically `Uint8Array`).
- Always pass `Uint8Array` to `Crypto.digest()`, never raw `ArrayBuffer`.
- This affected `storage/secure.ts` which is used for all encrypted storage operations.

### Emulator UI Automation Tips

- LogBox error bars block tab bar taps — dismiss X button is at approximately (996, 2209) on Medium_Phone_API_36.0.
- The IAP init error always appears on emulator (no Play Services billing) — dismiss it immediately.
- `adb shell am broadcast -a android.intent.action.MEDIA_SCANNER_SCAN_FILE` makes pushed files visible in the file picker.
- For form filling: hide keyboard (`keyevent 111`) between field taps to avoid focus issues.
- `uiautomator dump` + python3 XML parsing is reliable for finding exact element bounds.

### Test Backup File

- `test-backup.json` exists on emulator at `/sdcard/Download/test-backup.json`
- Contains: 1 Mutual Fund asset (₹4.1M), 1 Monthly expense (₹65K), profile (Paras), goals
- Added to `.gitignore`

### Key Facts Updated

| Fact | Old | New |
|---|---|---|
| versionCode | 32 | 33 |
| Latest commit | 984dc31 | d7bd1a0 |
| app.json versionCode | 28 | 33 (was out of sync) |
