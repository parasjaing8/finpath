# FinPath — Privacy Policy

**Last updated:** April 5, 2026

FinPath ("the App") is a personal financial independence planning tool developed by Paras Jain ("we", "our", "us"). This Privacy Policy explains what data the App collects, how it is stored, and your rights over that data.

---

## 1. Data We Collect

FinPath collects only the information you voluntarily enter:

| Data Type | Examples | Purpose |
|-----------|----------|---------|
| Personal details | Name, date of birth, currency preference | Profile identification; age-based FIRE projections |
| Financial information | Monthly income, retirement age, SIP amount, pension income | FIRE corpus and projection calculations |
| Asset records | Asset names, categories, current values | Net worth calculation |
| Expense records | Expense names, amounts, categories, dates | Present Value of future expenses |
| Security credentials | PIN (stored as salted SHA-256 hash — never in plain text) | Profile authentication |

We do **not** collect:

- Location or GPS data  
- Device identifiers or advertising IDs  
- Contact list, camera, microphone, or photos  
- Browsing history or app usage outside FinPath  
- Biometric data  

---

## 2. How Data Is Stored

**All data is stored exclusively on your device** in a local SQLite database (`SQLite/finpath.db`). No data is transmitted to any server, cloud service, or third party operated by us.

- The database is stored in the app's private storage directory, inaccessible to other apps on unrooted devices.
- Your PIN is never stored in plain text. It is stored as a salted SHA-256 hash.
- We do **not** operate any backend servers and have **no access** to your data.

---

## 3. Crash Reporting (Sentry)

The App integrates **Sentry** for anonymous crash reporting. If the App crashes, a crash report is sent to Sentry containing:

- Device OS version and model (anonymous)
- Stack trace of the error that caused the crash
- App version

Crash reports do **not** include any personal or financial data you have entered. You can review Sentry's privacy policy at [sentry.io/privacy](https://sentry.io/privacy/).

To opt out of crash reporting, you can disable it by removing the `EXPO_PUBLIC_SENTRY_DSN` configuration before building the app yourself.

---

## 4. Data Sharing

We do **not** sell, rent, or share your personal or financial data with any third party, except as described in Section 3 (Sentry crash reports, which contain no personal data).

---

## 5. Data Retention and Deletion

Your data remains on your device until you:

- Delete an individual profile within the App (removes all associated records)
- Uninstall the App (removes the entire local database)

We have no ability to delete data on your behalf since we never receive it.

---

## 6. Children's Privacy

FinPath is not directed at children under 13 years of age. We do not knowingly collect data from children under 13.

---

## 7. Security

We implement the following security measures:

- PIN authentication with per-profile salted hashing
- Rate limiting: profile access is locked after 5 incorrect PIN attempts
- All data stored in app-private storage

No app can guarantee absolute security. We recommend using a strong PIN and keeping your device secured.

---

## 8. Changes to This Policy

We may update this policy periodically. Material changes will be reflected by an updated "Last updated" date at the top. Continued use of the App after changes constitutes acceptance of the updated policy.

---

## 9. Contact Us

If you have questions or concerns about this Privacy Policy or your data, please contact:

**Paras Jain**  
Email: [your-email@example.com]  
GitHub: [https://github.com/parasjaing8/finpath](https://github.com/parasjaing8/finpath)

---

*FinPath stores all your financial data locally on your device. Your financial information never leaves your phone.*
