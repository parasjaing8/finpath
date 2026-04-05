# FinPath — Google Play Data Safety Form

Use this document as a reference when completing the **Data Safety** section in Google Play Console (App content → Data safety).

---

## Section 1 — Data Collection and Security

### Does your app collect or share any of the required user data types?
**→ Yes**

### Is all of the user data collected by your app encrypted in transit?
**→ Yes** (Sentry crash reports are sent over HTTPS/TLS. No other outbound data.)

### Do you provide a way for users to request that their data is deleted?
**→ Yes** — Users can delete a profile inside the app (Settings → Delete Profile), which cascades deletes all associated assets, expenses, and goals from the local SQLite database. Uninstalling the app also removes all data.

---

## Section 2 — Data Types Collected

For each data type below, select the options shown.

### Personal info

| Data type | Collected? | Shared? | Required/Optional | Processed ephemerally? | Notes |
|-----------|-----------|---------|-------------------|------------------------|-------|
| Name | ✅ Yes | ❌ No | Required | ❌ No (stored) | Profile display name |
| Date of birth | ✅ Yes | ❌ No | Required | ❌ No (stored) | Used for age-based FIRE projections |
| Other personal info | ❌ No | — | — | — | — |

### Financial info

| Data type | Collected? | Shared? | Required/Optional | Processed ephemerally? | Notes |
|-----------|-----------|---------|-------------------|------------------------|-------|
| User payment info | ❌ No | — | — | — | No payment data handled |
| Credit score | ❌ No | — | — | — | — |
| Other financial info | ✅ Yes | ❌ No | Required | ❌ No (stored) | Monthly income, asset values, expense amounts, retirement goals, SIP amount, pension income |

### App activity

| Data type | Collected? | Shared? | Required/Optional | Processed ephemerally? | Notes |
|-----------|-----------|---------|-------------------|------------------------|-------|
| App interactions | ❌ No | — | — | — | No analytics |
| In-app search history | ❌ No | — | — | — | — |
| Installed apps | ❌ No | — | — | — | — |
| Other user-generated content | ❌ No | — | — | — | — |
| Other actions | ❌ No | — | — | — | — |

### App info and performance

| Data type | Collected? | Shared? | Required/Optional | Processed ephemerally? | Notes |
|-----------|-----------|---------|-------------------|------------------------|-------|
| Crash logs | ✅ Yes | ✅ Yes (Sentry) | Required | ❌ No | Anonymous crash stack traces sent to Sentry; **no personal or financial data included** |
| Diagnostics | ❌ No | — | — | — | — |

### Device or other IDs

| Data type | Collected? | Shared? | Required/Optional | Processed ephemerally? | Notes |
|-----------|-----------|---------|-------------------|------------------------|-------|
| Device or other IDs | ❌ No | — | — | — | — |

### All other data types
**Not collected:** Location, contacts, messages, photos/videos, audio, health/fitness, calendar.

---

## Section 3 — Data Usage and Handling

### Personal info (Name, Date of birth)

- **Purpose:** App functionality — profile identification, age-based retirement projection calculations
- **Encrypted in transit:** N/A (stored only on-device; never transmitted)
- **User can request deletion:** Yes — via Delete Profile in the app

### Financial info

- **Purpose:** App functionality — FIRE corpus calculations, net worth projections, expense planning
- **Encrypted in transit:** N/A (stored only on-device; never transmitted)
- **User can request deletion:** Yes — via Delete Profile in the app

### Crash logs (Sentry)

- **Purpose:** Analytics — crash detection and bug fixing
- **Encrypted in transit:** Yes (HTTPS)
- **Data shared with:** Sentry (crash reporting service only — no personal or financial data included in reports)
- **User can request deletion:** [Sentry provides data deletion on request](https://sentry.io/privacy/)

---

## Section 4 — Security Practices

In the free-text "Security practices" field, enter:

> All user data (profile details, financial information, assets, and expenses) is stored exclusively on the user's device in a local SQLite database. No user data is transmitted to any server or cloud service operated by the developer. Crash reports sent to Sentry contain only anonymous technical data (stack traces, OS version, app version) with no personal or financial information. Profile authentication uses a PIN stored as a salted SHA-256 hash — the plaintext PIN is never stored or transmitted.

---

## Section 5 — Data Safety Summary (for the Play Store listing)

In the Play Store listing summary badge, the following will appear:

- ✅ Data is encrypted in transit
- ✅ You can request that data be deleted
- No data shared with third parties (except anonymous crash reports)
- No data collected (except crash logs and the data listed above)

---

## Checklist Before Submitting

- [ ] Enable GitHub Pages on the repo so `https://parasjaing8.github.io/finpath/PRIVACY_POLICY` is live
- [ ] Add the privacy policy URL in Play Console → App content → Privacy policy
- [ ] Complete the Data Safety form using the answers above
- [ ] Disable Android auto-backup (`android.allowBackup: false` in `app.json`) so the local DB cannot be restored to another device via Google Backup
- [ ] Submit the Data Safety form for review

---

## Note on Android Auto-Backup

By default Android backs up the app's data directory to Google Drive. This means the SQLite database (containing all financial data) could be backed up and restored to another device. The `allowBackup: false` flag in `app.json` disables this.

**This has already been added to `app.json`** (`android.allowBackup: false`).
