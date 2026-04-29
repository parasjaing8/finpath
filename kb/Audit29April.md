# Finpath Audit — 29 April 2026

> Audited by: Claude Opus | Branch: beyondv33 | Commit: 43be972
> Status legend: [ ] TODO | [x] DONE | [~] PARTIAL | [!] CRITICAL

## Summary

The app is solid for INR-only single-asset-class users but has **three gaps that block the stated tester feedback**: (1) the asset form exposes no vesting fields, so the engine's ESOP/RSU vesting logic is dead code unless data is imported via JSON backup; (2) currency support is uneven — `create-profile` and `edit-profile` offer 8 currencies but the in-tab `profile.tsx` "Edit" card only offers INR/USD, and the codebase carries no per-asset secondary currency at all; (3) the only paid feature, CSV export, is plain text — no PDF, no charts, no infrastructure for them.

Beyond the feedback themes, the audit found a **critical category-vocabulary split** (assets UI uses `EQUITY/MUTUAL_FUND/...`, engine vesting code looks for `ESOP_RSU` only — they do not match), a confirmed **post-retirement projection math bug** carried over from the prior audit (now confirmed it touches actual corpus, not just display), **stale Android permissions** (READ/WRITE_EXTERNAL_STORAGE) likely to draw Play Store warnings, and an **un-implemented secondary-currency model** for ESOP/RSU/ESPP. The dual storage warning in ARCHITECTURE.md is **stale** — `AppContext` no longer dual-writes; SQLite is now the source of truth and AsyncStorage is used only for migration sentinels and the legacy backup format. Documentation should be corrected.

---

## Finding Index

| ID | Area | Severity | Title | Status |
|---|---|---|---|---|
| A1 | Asset UX | High | Asset form has no vesting fields — ESOP/RSU vesting is unreachable | [x] |
| A2 | Asset UX | Critical | Category vocabulary split: UI uses `EQUITY` etc., engine vesting expects `ESOP_RSU` | [x] |
| A3 | Asset UX | Medium | Add-asset modal: 5 fields + scroll-chip category, no quick-add path | [ ] |
| A4 | Asset UX | Low | Default ROI changes when category changes, silently overwriting user input | [ ] |
| A5 | Asset UX | Low | No swipe-to-delete, no bulk add, no clone-from-existing | [ ] |
| A6 | Asset UX | Medium | `expected_roi` stored as 0 from UI when user accepts default — engine treats 0 ≠ null | [ ] |
| B1 | Reporting | High | CSV is the only export format; PDF promised in paywall, never implemented | [x] |
| B2 | Reporting | Low | CSV exports `totalNetExpenses` — misleading column name (it's corpus withdrawal, not net expenses) | [x] |
| B3 | Reporting | Low | CSV has no summary section (FIRE corpus, required SIP, profile context) | [x] |
| B4 | Reporting | Low | No share-as-image of dashboard chart | [ ] |
| C1 | Currency | High | Profile-tab "Edit" card hardcodes INR/USD only (vs 8 elsewhere) | [x] |
| C2 | Currency | High | No country-search dropdown; no full ISO-4217 list anywhere | [x] |
| C3 | Currency | Medium | `formatCurrency` short-scale (Cr/L/K) only for INR; other currencies show full numbers | [x] |
| C4 | Currency | Medium | Currency stored per-asset in DB but every code path normalizes to profile.currency | [ ] |
| C5 | Currency | Critical | No FX conversion engine; secondary currency is a string field with no math | [x] |
| D1 | ESOP/RSU | High | Asset interface has vesting fields, but UI never sets them | [x] |
| D2 | ESOP/RSU | High | Vesting frequencies limited to MONTHLY/QUARTERLY/ANNUALLY — no half-yearly | [x] |
| D3 | ESOP/RSU | High | No cliff-period model; no per-tranche vesting | [x] |
| D4 | ESOP/RSU | High | Vesting amount stored in profile currency; no USD-grant → INR-vest path | [x] |
| D5 | ESOP/RSU | Medium | RSU form would need: grant currency, FX rate, cliff, vest schedule, tax model | [ ] |
| E1 | FIRE Engine | High | `totalNetExpenses` post-retirement adds pension to expenses; corpus path uses it | [x] |
| E2 | FIRE Engine | Medium | `PENSION_INFLATION_RATE` hardcoded 6%; ignores user `goals.inflation_rate` (Option B by design) | [~] |
| E3 | FIRE Engine | Medium | `expected_roi == 0` semantics: UI writes 0, engine treats 0 as "valid 0%" | [ ] |
| E4 | FIRE Engine | Low | `calculateFutureGoalsCorpus` has zero unit tests | [ ] |
| E5 | FIRE Engine | Low | No tax modelling, no sequence-of-returns risk, no real-vs-nominal split | [ ] |
| F1 | Validation | Medium | `monthly_income == 0` produces no SIP burden warning, projections still compute | [ ] |
| F2 | Validation | Medium | No assets + no expenses: dashboard renders but corpus = 0 with no guidance | [ ] |
| F3 | Validation | Medium | Expense `amount > 0` is the only check; no ceiling, no NaN trap on edge inputs | [ ] |
| F4 | Validation | Medium | Retirement age can be set < current age; no validation | [ ] |
| F5 | Validation | Low | ESOP date fields not validated (not exposed, but DB allows malformed strings) | [ ] |
| F6 | Validation | Medium | Expense start_date / end_date input is masked, but no inversion check | [ ] |
| G1 | Security | Low | `storage/secure.ts` is robust AES-CBC+HMAC, but no longer used for primary data | [ ] |
| G2 | Security | Low | PIN hash uses single SHA-256(salt+pin) — no PBKDF2 / Argon2 / iteration count | [ ] |
| G3 | Security | Low | Exported backup JSON contains all data in plaintext, no passphrase wrap | [ ] |
| G4 | Security | Medium | No backup encryption: anyone with the JSON sees all financial data | [ ] |
| G5 | Security | Low | Lockout window is 30s/5m/30m — no exponential beyond 11 attempts | [ ] |
| H1 | Performance | Medium | Dashboard recomputes full 70-year projection on every slider tick (debounced via display state, but `result` recalcs on commit) | [ ] |
| H2 | Performance | Low | `calculateRequiredSIP` runs binary search ~60 iterations × full simulation — fine but uncached | [ ] |
| H3 | Performance | Low | Vesting income computed inside year loop — re-iterates `assets` every year | [ ] |
| I1 | UX | Medium | No empty-state CTA flow from Goals → Assets → Dashboard | [ ] |
| I2 | UX | Medium | `profile.tsx` and `app/onboarding/edit-profile.tsx` are two separate edit screens | [ ] |
| I3 | UX | Low | Disclaimer dialog text is India-specific (SEBI), shown to international users | [ ] |
| I4 | UX | Low | No "you are here" marker on projection chart (TRANSFORM D3 partial) | [ ] |
| I5 | UX | Low | Vesting column always shown in projections table (TRANSFORM D6 open) | [ ] |
| I6 | UX | Low | Goals screen FIRE labels (`Lean/Moderate/Fat`) clash with engine `lean/moderate/fat/custom` strings — case mismatch breaks `FIRE_TARGET_AGES` lookup | [ ] |
| I7 | UX | Medium | "Forgot PIN" deletes the entire profile — no recovery, no warning about asset loss | [ ] |
| J1 | Play Store | High | AndroidManifest still has READ/WRITE_EXTERNAL_STORAGE — not needed, may trigger Play warning | [x] |
| J2 | Play Store | Medium | `allowBackup="true"` in manifest enables auto-backup of (now-encrypted) data to Google Drive | [ ] |
| J3 | Play Store | Low | App targets `android:enableOnBackInvokedCallback="false"` — should be true for predictive back on Android 14+ | [ ] |
| J4 | Play Store | Low | India-flag emoji in profile screen ("Made with ❤️ from 🇮🇳") may feel parochial to non-Indian testers | [ ] |
| J5 | Play Store | Medium | `aihomecloud.com/finpath/privacy` is the only privacy URL — must be live and current for international users | [ ] |
| K1 | Doc Drift | Medium | ARCHITECTURE.md "Dual Storage Warning" is stale — code now uses SQLite-only | [x] |
| K2 | Doc Drift | Medium | FUNCTION_INDEX.md asset categories list (`ESOP_RSU/STOCKS/MUTUAL_FUND/...`) does not match the actual `assets.tsx` (`EQUITY/MUTUAL_FUND/DEBT/...`) | [x] |
| K3 | Doc Drift | Low | DECISIONS_AND_LESSONS describes `totalNetExpenses` bug as "Display-only" — it also feeds corpus path L503 | [x] |

---

## Findings

### A — Asset & Expense Management

#### A1 — Asset form has no vesting fields  [Severity: High]
**Dev perspective:** `engine/calculator.ts:147` (`calculateVestingForYear`) iterates assets where `category === 'ESOP_RSU'` AND `is_recurring` AND `recurring_amount` AND `next_vesting_date`. The UI in `app/(tabs)/assets.tsx` (the AssetForm at L44–L58) only collects `name, category, current_value, expected_roi, is_self_use` — it never sets any of the recurring/vesting fields. Result: a user adding "Microsoft RSUs" can record only the current value; the projection treats it as a static lump that grows at category ROI, with zero vesting income. The whole `calculateVestingForYear` path is unreachable from the UI for newly created profiles. Only legacy data (imported via JSON or seeded via the deprecated AsyncStorage path) can populate those columns.
**User perspective:** "I have RSUs vesting quarterly for the next 4 years" → user cannot enter that. The dashboard understates future net worth.
**Root cause:** `app/(tabs)/assets.tsx:44–58, 244–292`
**Suggested fix:** Add a conditional ESOP/RSU section to the asset modal: when `category === 'ESOP_RSU'`, show toggle "vesting schedule", and when toggled, expose `recurring_amount`, `recurring_frequency` (use existing FREQUENCIES list), `next_vesting_date` (DateInput), `vesting_end_date` (DateInput). Persist to existing columns. Also depends on D2 (add HALF_YEARLY).

#### A2 — Category vocabulary split  [Severity: Critical]
**Dev perspective:** `app/(tabs)/assets.tsx:13–26` defines its own CATEGORIES array: `EQUITY, MUTUAL_FUND, DEBT, FIXED_DEPOSIT, PPF, EPF, GOLD, REAL_ESTATE, CRYPTO, CASH, ESOP_RSU, OTHERS`. `engine/types.ts:44` `DEFAULT_GROWTH_RATES` covers all of these (good). But `engine/calculator.ts:150` filters `asset.category !== 'ESOP_RSU'`. So the only category that triggers vesting math is `ESOP_RSU`. A user who picks the "ESOP/RSU" chip writes `ESOP_RSU` — fine. But the docs (kb/ARCHITECTURE.md L116, kb/FUNCTION_INDEX.md L79) describe an entirely different category set (`STOCKS/MUTUAL_FUND/SAVINGS/GOLD_SILVER/PF/NPS/REAL_ESTATE`). These docs are stale.
**User perspective:** None visible — UI and engine agree by accident on `ESOP_RSU`. But this is fragile: any rename in the UI silently breaks vesting.
**Root cause:** Two sources of truth for category strings; no shared constant.
**Suggested fix:** Move the canonical CATEGORIES list to `engine/types.ts` (or `constants/categories.ts`), import from both UI and engine. Update kb/ARCHITECTURE.md to match. K2 below tracks the doc drift.

#### A3 — Asset modal weight  [Severity: Medium]
**Dev perspective:** Modal opens to a slide-up sheet with: Name, Category (12 chips, horizontal scroll), Current Value, Expected Return, Self-use checkbox. With keyboard: Name input → keyboard → category scroll (often missed) → value → ROI → save. Five touch targets minimum, plus horizontal scroll discovery.
**User perspective:** Tester feedback "feels heavy". Adding ten assets is ten full sheet-traversals.
**Suggested fix:** Two-tier add: a **quick-add** row at the top of the assets list (just "Name" + "Value" → uses category default ROI, defaults to MUTUAL_FUND) and an "Advanced" toggle that exposes category, ROI, self-use. Or a "+" floating mini-menu of common categories that prefills the modal. Dashboard should still feel fast with 10–15 assets.

#### A4 — Default ROI overwrite  [Severity: Low]
**Dev perspective:** `assets.tsx:249` — when user picks a category chip, `expected_roi` is set to the category's default ROI string. If the user already typed a custom ROI then changes the category, their input is silently overwritten. No "dirty" tracking.
**Suggested fix:** Only overwrite if the prior value matches the prior category's default (i.e. user hasn't customized).

#### A5 — Bulk operations  [Severity: Low]
**Dev perspective:** No swipe-to-delete (only edit/trash icons in row), no clone, no bulk-import (e.g. paste a CSV of holdings).
**User perspective:** Adding 15 mutual funds is tedious.
**Suggested fix:** Add swipe-to-delete on iOS-style; add "Duplicate" to long-press menu. Bulk-import can be deferred.

#### A6 — `expected_roi` zero ambiguity (revisited)  [Severity: Medium]
**Dev perspective:** `engine/calculator.ts:171` correctly treats `expected_roi == null` as "fall back to default", and `expected_roi == 0` as "honor user's explicit 0%". But the UI `assets.tsx:106` writes `isNaN(roi) ? 8 : roi` — there is no path for the user to express "no opinion, use category default". So all newly created assets carry an explicit numeric ROI; the null branch is dead. This is fine today, but if A1 lands and adds vesting plus per-asset ROI controls, the UI must allow null.
**Suggested fix:** When the user accepts the category default, persist `null` rather than the displayed default number.

---

### B — Reporting & Export

#### B1 — No PDF, no chart export  [Severity: High]
**Dev perspective:** `utils/export.ts` is the only export path. It writes a 3-section CSV (Assets / Expenses / Year-by-Year). No PDF library is in `package.json` (`react-native-pdf`, `react-native-html-to-pdf`, `expo-print` — none present). `ProPaywall.tsx:14` advertises "PDF report with charts (coming soon)" — promised but unbuilt. Tester complaint validates this.
**User perspective:** CSV is unfriendly: opens in Excel/Sheets, plain numbers, no narrative. A user who has paid ₹199 cannot share a PDF with their spouse or advisor.
**Suggested fix:** Add `expo-print` (it ships with Expo SDK 54). Generate a templated HTML page server-side (in JS, no actual server) that contains: profile summary, FIRE corpus, required SIP, asset pie (SVG inline), 5-year/10-year/retirement net-worth tiles, and a year-by-year table. Render via `Print.printToFileAsync()` → share. Charts can be inline SVG generated from the projections array — same data the dashboard uses. Keep CSV as a separate option for power users.

#### B2 — CSV exports the buggy `totalNetExpenses`  [Severity: Medium]
**Dev perspective:** `utils/export.ts:39` writes `p.totalNetExpenses`. From `calculator.ts:480`: `age >= retirementAge ? (pensionIncome + plannedExpenses) : preRetFutureCost`. Pension is being added to expenses post-retirement, not subtracted. The CSV column is mislabeled — it shows total cash flowing past the user, not net withdrawal from corpus.
**User perspective:** The exported CSV will look inflated post-retirement; a sharp user will spot it.
**Root cause:** `calculator.ts:480` (also see E1)
**Suggested fix:** Rename the field to `totalGrossOutflow` to make semantics explicit, or fix the formula and update column header. E1 covers the corpus-path consequence.

#### B3 — CSV missing summary block  [Severity: Low]
**Dev perspective:** No FIRE corpus, no required SIP, no profile name DOB context, no current-month timestamp other than filename.
**Suggested fix:** Add a top "SUMMARY" section before "ASSETS": profile (name, age, currency, monthly income), goals (retirement age, FIRE type, withdrawal target), computed (FIRE corpus, required monthly SIP, projected NW at retirement, projected NW at age 100). Three lines, huge improvement.

#### B4 — Chart-as-image share  [Severity: Low]
Skia has the primitives. Could add later.

---

### C — Currency & Internationalization

#### C1 — Profile-tab "Edit" card has only INR/USD  [Severity: High]
**Dev perspective:** `app/(tabs)/profile.tsx:19–22` defines `CURRENCIES = [{ key: 'INR' }, { key: 'USD' }]`. The same screen flow's create/edit-profile pages (`app/onboarding/create-profile.tsx:16–25` and `edit-profile.tsx:13–22`) define **eight** currencies (INR, USD, EUR, GBP, AUD, CAD, SGD, AED). A user who creates the profile in EUR can NEVER set it back to EUR from the in-app profile screen — the EUR pill isn't there. Saving switches them to one of the two visible options.
**User perspective:** Silent currency stomping for any non-INR/USD user. This is a data-correctness regression.
**Root cause:** `app/(tabs)/profile.tsx:19–22, 354–371`
**Suggested fix:** Use the same CURRENCIES list everywhere. Better, factor out to a shared module `constants/currencies.ts`. Note: `engine/calculator.ts:587` already supports formatting for those 8 currencies, so the math layer is fine — only the form is inconsistent.

#### C2 — No country-search; only 8 currencies  [Severity: High]
**Dev perspective:** The app has 8 hardcoded currencies. Tester feedback explicitly asks for a worldwide list with country search.
**User perspective:** A tester in Switzerland (CHF), Japan (JPY), Brazil (BRL), or Saudi Arabia (SAR) cannot pick their currency.
**Suggested fix:** Add a full ISO-4217 list (~180 currencies). Build a small searchable picker (TextInput + filtered list of `{ countryFlag, currencyCode, country }`). For the K/L/Cr short-scale logic in `formatCurrency`, only INR uses lakh/crore; for everything else, fall back to `toLocaleString` (already the default branch). The `CURRENCY_META` object in `calculator.ts:587` would need extending — add a generic fallback (`{ symbol: code, locale: 'en-US' }`) that's already there for unknown currencies, so the engine would not need ISO 4217 data baked in. UI would carry the country list.

#### C3 — Short-scale only for INR  [Severity: Medium]
**Dev perspective:** `engine/calculator.ts:587–605` defines short-scale only for INR (Cr/L/K). USD, EUR etc. fall through to `toLocaleString` which is full-number with commas. A US user with $5M sees "$5,000,000" everywhere — readable but cluttered. (Most US apps use "$5M" or "$5.2M".)
**Suggested fix:** Add `shortScale` for USD/EUR/GBP using K/M/B: `{ divisor: 1e9, suffix: 'B' }, { 1e6, 'M' }, { 1e3, 'K' }`. Skip for AED/SGD/AUD/CAD if uncertain. Cheap improvement.

#### C4 — Per-asset currency not effective  [Severity: Medium]
**Dev perspective:** `db/schema.ts:36` has `currency TEXT DEFAULT 'INR'` per asset. `db/queries.ts:218` writes `asset.currency`. `context/AppContext.tsx:229` overrides with `profile.currency` on insert. The asset's `currency` field is set but is never read by the engine or UI. Effectively, every asset is in profile currency.
**User perspective:** No visible effect today. But it's a half-built feature: the column exists, looks like it should support multi-currency, doesn't.
**Suggested fix:** Decide one path: either (a) drop the per-asset currency column (simplification — defer to D5), or (b) actually use it in `engine/calculator.ts` with FX conversion at projection time (C5). The current half-state is misleading.

#### C5 — No FX conversion engine  [Severity: Critical]
**Dev perspective:** No FX layer. `utils/export.ts` does not convert. `engine/calculator.ts` sums asset values directly into `initialNetWorth` regardless of any per-asset currency. The kb mentions a `convertToINR` helper in `utils/currency.ts` (FUNCTION_INDEX L102), **but the file does not exist** in this repo: `ls utils/` returns only `export.ts` and `inflation.ts`. The kb is outdated.
**User perspective:** A tester with USD ESOPs and INR salary cannot represent reality. This is the heart of the tester ESOP feedback.
**Suggested fix:** Build an FX layer:
1. `utils/fx.ts` with `getRate(from, to)` (open.er-api.com or exchangerate.host, both free, no key); 24-hour cache in AsyncStorage; offline fallback to last cached.
2. Asset model gains `value_currency` (the currency the asset is denominated in) AND `vesting_currency` (the currency vesting tranches arrive in — for ESPP/RSU these may differ).
3. Engine converts every read at compute time: `convertToProfileCurrency(asset.current_value, asset.value_currency, profile.currency, fxAt(today))`.
4. Vesting income converted per-event at the FX rate "today" (we don't predict future FX). UI banner: "Vesting amounts shown converted at today's rate."

---

### D — ESOP/ESPP/RSU Modeling

#### D1 — Vesting fields exist but UI doesn't expose them  [Severity: High]
See A1. Schema has `is_recurring, recurring_amount, recurring_frequency, next_vesting_date, vesting_end_date`. UI ignores them all.
**Suggested fix:** Same as A1.

#### D2 — Frequency set lacks HALF_YEARLY  [Severity: High]
**Dev perspective:** `engine/types.ts:7` defines Frequency as `MONTHLY | QUARTERLY | ANNUALLY | ONE_TIME`. The kb FUNCTION_INDEX L82 mentions `HALF_YEARLY(×2)` — that's an aspirational doc, not the actual code. Tester feedback explicitly asks for half-yearly.
**User perspective:** "My RSUs vest every 6 months" → cannot represent.
**Root cause:** `engine/types.ts:7–11`
**Suggested fix:** Add `'HALF_YEARLY'` to Frequency, set `FREQUENCY_TO_PAYMENTS_PER_YEAR['HALF_YEARLY'] = 2` and `FREQUENCY_TO_MONTHS_PER_PAYMENT['HALF_YEARLY'] = 6`. Existing migrations infrastructure handles the type extension. Add to `FREQUENCIES` UI array.

#### D3 — No cliff, no per-tranche schedule  [Severity: High]
**Dev perspective:** `calculateVestingForYear` assumes one fixed amount × N times per year, repeating until `vesting_end_date`. Real-world RSU schedules: 4-year vest, 1-year cliff, 25% on cliff date, 6.25% per quarter thereafter. ESPP: enrollment period, lookback, 15% discount, biannual purchases. None of this is modelable.
**User perspective:** Tester explicitly mentioned "quarterly/half-yearly/yearly on specific dates" and "vesting schedules". The current model handles "regular cadence from a start date" but not cliff.
**Suggested fix:** Two-step. **Phase 1** (covers 80% of cases): add a `cliff_date` column. Vesting starts on cliff_date instead of next_vesting_date. Existing recurring math runs as-is. **Phase 2** (full-fidelity): a separate `vesting_schedule` table with one row per tranche `(asset_id, vest_date, amount, currency)`. UI offers "Use schedule" mode where the user enters or imports the schedule. Engine reads from `vesting_schedule` if present, else falls back to recurring fields.

#### D4 — Vesting amount stored in profile currency only  [Severity: High]
**Dev perspective:** `recurring_amount` has no currency. The engine adds it directly to corpus growth in profile-currency units. A user with USD-denominated RSUs cannot enter $500/quarter; they have to pre-convert to INR and lose the link to USD.
**User perspective:** Tester explicit: "USD grants, INR vest".
**Suggested fix:** Add `recurring_amount_currency` column (or `vesting_currency` if going broader per D5). At projection time, convert each tranche via FX (C5). Store the original currency so the user's record reflects truth.

#### D5 — Full RSU/ESPP form needs a richer model  [Severity: Medium]
**Dev perspective:** A complete model requires:
- Grant currency (e.g. USD)
- Total grant size
- Cliff date
- Vest schedule (frequency or explicit tranches)
- Vest end date
- Tax model (RSU: ordinary income at vest; ESPP: discount + holding period; ISO: AMT) — Phase 3
- FX rate at vest (predicted vs actual)
**Suggested fix:** Group these behind a single "ESOP/RSU/ESPP" asset subtype with its own form. Don't pollute the generic asset modal. Likely a separate "Add Vesting Asset" CTA on the assets screen.

---

### E — FIRE Engine

#### E1 — `totalNetExpenses` in corpus path — audit false positive  [Severity: ~~Critical~~ → Closed]
**2026-04-29 correction:** The formula IS correct. Both `simulateCorpusAtAge` and the projection loop compute post-retirement withdrawal the same way: `pensionIncome * 12 * inflation^years + futureExpenses`. `pension_income` in this app is the desired *withdrawal* from corpus (see DECISIONS_AND_LESSONS 2026-04-06 "Pension model clarification" — there is no external pension concept). Applying `plannedExpenses - pensionIncome` as originally suggested would break the math by treating pension as income that reduces the withdrawal.

What IS true: the prior audit's "display-only" claim was wrong — `totalNetExpenses` IS used at L503 in the corpus path. But it's computing the right value.

**Naming smell (Low, non-blocking):** `pensionIncome` / `totalNetExpenses` are confusing names; they represent corpus withdrawal amounts. Future cleanup: rename to `annualWithdrawal` / `totalWithdrawal`.

**Status:** Closed — no code change required. DECISIONS_AND_LESSONS corrected.

#### E2 — Pension inflation hardcoded  [Severity: Medium]
**Dev perspective:** `PENSION_INFLATION_RATE = 0.06` is hardcoded. Code passes `discountRate` (= `goals.inflation_rate / 100`) to `simulateCorpusAtAge`, so the projection actually does use the user's inflation_rate. But `PENSION_INFLATION_RATE` constant is still exported and referenced in the kb as if used. It is currently dead code in the engine.
**Suggested fix:** Either delete the constant (cleaner), or formally split "asset inflation" from "pension inflation" if there's a real reason. Today they're the same number; no separation needed.

#### E3 — Per-asset ROI null vs 0  [Severity: Medium]
See A6. Engine logic is correct; UI never writes null.

#### E4 — `calculateFutureGoalsCorpus` has no tests  [Severity: Low]
**Dev perspective:** kb DECISIONS_AND_LESSONS L17 already flagged this. Function shipped at `calculator.ts:618`; no test in `__tests__/`. (Verify with `find __tests__ -name '*calculator*'`.)
**Suggested fix:** Add Jest cases for: empty future expenses (returns 0), one one-time expense, recurring expenses spanning retirement, currency-agnostic.

#### E5 — Tax modelling absent  [Severity: Low]
Documented model limitation. Not changing without tester feedback.

---

### F — Data Validation & Edge Cases

#### F1 — Zero income produces no SIP burden warning  [Severity: Medium]
**Dev perspective:** `calculator.ts:541` `if (monthlyIncome > 0) { ... }`. Income == 0 falls through to `sipBurdenWarning = null`. The dashboard `sipBurdenInsight` derivation (`dashboard.tsx:206`) similarly bails. So a user who hasn't entered income gets no warning that the required SIP exceeds their salary — silently.
**Suggested fix:** When `monthlyIncome <= 0`, surface a different InsightCard: "Add your monthly income for a sustainability check."

#### F2 — Empty-state dashboard  [Severity: Medium]
**Dev perspective:** With no assets, no expenses, but goals set, dashboard renders with `requiredMonthlySIP = 0` (or some big number depending on pension/inflation). Hero card shows "Assets cover retirement" if requiredSIP <= 0. That's misleading for a user who simply hasn't input anything.
**Suggested fix:** If `assets.length === 0 && expenses.length === 0`, replace HeroCard with onboarding nudge: "Add your first asset to see projections." This is more honest than computing zero.

#### F3 — Numeric input validation  [Severity: Medium]
**Dev perspective:** Asset/expense forms parseFloat with isNaN check; reject `<= 0`. No upper bound (user can enter 1e15). No NaN trap on locale-formatted input ("30,000"). Test: enter "300000000000000" — UI accepts, engine produces Infinity downstream.
**Suggested fix:** Cap at 1e12 (~ ₹1 trillion), reject Infinity/NaN explicitly, optionally accept comma-formatted input.

#### F4 — Retirement age vs current age  [Severity: Medium]
**Dev perspective:** `goals.tsx:80` slider min is 35. If user is 50 today and sets retirement_age = 35, the engine still runs — projections start with retirement already in the past, the loop advances from currentAge. `calculator.ts:444` loops `for (let age = currentAge; age <= 100; age++)`. The condition `age >= retirementAge` is true from the first year, so retirement merge happens immediately. Behavior is technically correct (FIRE achieved, no SIP needed) but UX is confusing.
**Suggested fix:** Slider min should be `Math.max(35, currentAge + 1)`. Also, if `retirement_age <= currentAge`, show a banner: "Already past your set retirement age — adjust to plan ahead."

#### F5 — ESOP date string validation  [Severity: Low]
Once the UI exposes vesting fields (A1), validate that `next_vesting_date < vesting_end_date` and both are valid YYYY-MM-DD.

#### F6 — Expense start_date / end_date inversion  [Severity: Medium]
**Dev perspective:** `expenses.tsx` validates only `amount > 0` and `name`. No check that start_date <= end_date (FUTURE_RECURRING).
**Suggested fix:** Reject save if start > end. The engine `calculateExpenseForYear` returns 0 for inverted ranges silently — no crash, but no expense ever fires.

---

### G — Security & Integrity

#### G1 — `storage/secure.ts` is robust but unused for primary data  [Severity: Low]
**Dev perspective:** AES-256-CBC + HMAC-SHA256 with master key in SecureStore — this is well-built. But the new SQLite-only architecture means it's used for nothing except the legacy AsyncStorage migration path. SQLite itself is unencrypted (expo-sqlite has no SQLCipher hook). On a rooted device, the SQLite file is readable.
**User perspective:** "All your data lives only on this device" (Backup dialog text) implies privacy. SQLite file at `/data/data/com.aihomecloud.finpath/databases/finpath.db` is not encrypted.
**Suggested fix:** Either (a) add SQLCipher (significant native work, larger APK) or (b) be honest in privacy copy: "data on device, accessible to anyone with root access". Since the threat model is "phone lost/stolen, attacker doesn't have root", current setup is acceptable — phone-level encryption protects normal users. Document this explicitly in privacy text.

#### G2 — PIN hash uses single-round SHA-256  [Severity: Low]
**Dev perspective:** `app/onboarding/create-profile.tsx:142` and `app/login.tsx:117` compute `SHA-256(salt + pin)`. Single-round, no key-stretching. Brute force of a 6-digit PIN: 1M candidates × ~1µs = ~1 second on commodity hardware if attacker has the hash. With salt, no rainbow table; without stretching, brute is trivial.
**User perspective:** Only matters if the SecureStore-stored hash leaks (full-device compromise). Lockout (5 attempts → 30s, etc.) protects against UI-driven brute, not offline.
**Suggested fix:** Switch to PBKDF2-SHA256 with 100K iterations (or scrypt/argon2 if a JS-pure lib is OK). expo-crypto doesn't expose PBKDF2 directly; would need a JS PBKDF2 implementation. Defer unless threat model warrants.

#### G3/G4 — Backup JSON is plaintext  [Severity: Medium]
**Dev perspective:** `app/(tabs)/profile.tsx:175` `handleExport` writes raw `JSON.stringify(payload, null, 2)`. Includes monthly_income, every asset value, expenses, DOB. Anyone who reads the .json sees everything.
**User perspective:** User shares backup via WhatsApp / email → recipient (or mail provider) sees full financials.
**Suggested fix:** Wrap export in a passphrase: prompt for a passphrase on export, run PBKDF2 to derive a key, AES-CBC the payload, write `{ kdf, iv, ct, mac }`. Reuse `storage/secure.ts` primitives — they're already there. Import prompts for passphrase. Keep an "I understand, export plaintext" option for users who insist.

#### G5 — Lockout duration doesn't grow indefinitely  [Severity: Low]
**Dev perspective:** `db/queries.ts:185–189` clamps at 30 minutes after 11 attempts. An attacker can run 11 attempts every 30 minutes = ~22 PINs/hour against a 1M space.
**Suggested fix:** Exponential past 11 attempts (1h, 4h, 24h). Current scheme is acceptable; not a priority.

---

### H — Performance

#### H1 — Dashboard projection recompute  [Severity: Medium]
**Dev perspective:** `dashboard.tsx:57–74` `useMemo` recomputes the full 70-year projection whenever any of 8 deps changes. The display-vs-commit slider pattern (`sipAmountDisplay` vs `sipAmount`) means it only fires on finger-lift, which is good. But binary search inside `calculateRequiredSIP` is ~60 iterations × 70 years × ~5 expenses × ~10 assets = ~210,000 inner-loop ops per slider commit. On older Androids (Snapdragon 600 series) this is noticeable (~200ms hitch). On newer it's <50ms.
**Suggested fix:** Memoize per-input deeply. Or short-circuit when only `sipAmount` changes: `requiredMonthlySIP` doesn't depend on `sipAmount`, only on initialNetWorth/expenses/goals. Cache the binary-search result keyed on those inputs.

#### H2 — Binary search uncached  [Severity: Low]
See H1.

#### H3 — Vesting iterates assets per year  [Severity: Low]
**Dev perspective:** `calculator.ts:147` `calculateVestingForYear` iterates all assets every year × 70 years. Trivial today (10–20 assets), but if D3 lands and vesting_schedule has hundreds of tranches, this matters.
**Suggested fix:** Pre-build a `Map<year, vestingIncome>` once before the projection loop.

---

### I — UX & Polish

#### I1 — Empty-state navigation  [Severity: Medium]
**Dev perspective:** New user lands at Assets tab (per index.tsx flow). No nudge to "set goals first" — but Dashboard requires goals. If user adds assets first, then visits Dashboard, they hit the "No plan set yet" screen. Order is: Goals → Assets → Dashboard. UI doesn't enforce or guide.
**Suggested fix:** First launch shows a 3-step progress strip across the bottom: "1. Goals → 2. Assets → 3. Dashboard". Hide once dismissed.

#### I2 — Two profile-edit screens  [Severity: Medium]
**Dev perspective:** `app/(tabs)/profile.tsx` has its own edit form (avatar, name, dob, income, currency, save button). `app/onboarding/edit-profile.tsx` is a separate screen with the same fields plus PIN change. They use **different currency lists** (C1) and slightly different validation. Two sources of truth.
**Suggested fix:** Pick one. Either delete `onboarding/edit-profile.tsx` and put PIN-change in the (tabs)/profile.tsx (already there as a dialog), or remove the inline form on (tabs)/profile.tsx and link to the onboarding edit screen.

#### I3 — SEBI-only disclaimer  [Severity: Low]
**Dev perspective:** `dashboard.tsx:333` "FinPath is not a SEBI-registered investment advisor." SEBI is India-specific. International users will be confused.
**Suggested fix:** "FinPath is not a registered investment advisor in any jurisdiction. Consult a licensed financial advisor in your country before making major investment decisions."

#### I4 — "You are here" marker  [Severity: Low]
TRANSFORM D3 partial. Defer.

#### I5 — Vesting column in projections table  [Severity: Low]
TRANSFORM D6 open. If A1 lands, this becomes more relevant. Hide column when sum across all years is 0.

#### I6 — FIRE type case mismatch  [Severity: Low]
**Dev perspective:** `db/queries.ts:53` defines `FireType = 'lean' | 'moderate' | 'fat' | 'custom'` (lowercase). Migration L106 backfills `slim → lean`. Goals form `app/(tabs)/goals.tsx:14–19` uses `key: 'lean' | 'moderate' | 'fat' | 'custom'` (lowercase). Engine `calculator.ts:23` `FIRE_TARGET_AGES = { lean: 85, moderate: 100, fat: 120 }` lowercase. Looks consistent now. But kb/FUNCTION_INDEX L28 lists `slim/moderate/fat` — stale doc.
**Suggested fix:** Update FUNCTION_INDEX. Code is fine.

#### I7 — "Forgot PIN" deletes profile silently  [Severity: Medium]
**Dev perspective:** `app/login.tsx:276–296` "Forgot PIN?" → confirm → calls `deleteProfile(id)`. The confirm message says "permanently delete the profile and all its data". User feedback on this flow may be brutal — there's no recovery path other than a JSON backup the user may not have made.
**User perspective:** Closed-testing user forgets PIN once, loses everything.
**Suggested fix:** Surface a stronger dialog: "Delete profile? Did you export a backup recently? Without backup, all assets, expenses, and goals are lost." Two-tap confirmation. Optionally check if a backup was ever made (not currently tracked).

---

### J — Play Store / Launch Readiness

#### J1 — Stale storage permissions  [Severity: High]
**Dev perspective:** `android/app/src/main/AndroidManifest.xml`:
```
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"/>
<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE"/>
```
Modern Expo SDK 54 + scoped storage on Android 11+ doesn't need these. They were noted in ARCHITECTURE.md "Known Issues" but never removed. Play Console may flag for review or trigger "this app requests broad storage access" warning.
**Suggested fix:** Remove from manifest. The CSV export uses `cacheDirectory` + Sharing — no external storage needed. Test on a clean install before release.

#### J2 — `allowBackup="true"`  [Severity: Medium]
**Dev perspective:** Manifest has `android:allowBackup="true"` plus `secure_store_backup_rules` referenced. Auto-backup uploads encrypted SecureStore to Google Drive (good) but also the SQLite file via the rules. Verify the rules exclude `databases/finpath.db` (haven't read the XML).
**Suggested fix:** Read `android/app/src/main/res/xml/secure_store_backup_rules.xml`; ensure SQLite is excluded OR explicitly included with the user's understanding. Google Drive backup of unencrypted financial data is a privacy concern.

#### J3 — Predictive back  [Severity: Low]
**Dev perspective:** `enableOnBackInvokedCallback="false"`. Android 14 deprecates the old back-press path; switching to `true` improves predictive back gesture. Not blocking.

#### J4 — India flag in profile screen  [Severity: Low]
**Dev perspective:** `profile.tsx:460` "Made with ❤️ from 🇮🇳 for the world". Charming for Indian users; potentially off-putting to international testers expecting a neutral product.
**Suggested fix:** Move to "About" page; keep "for the world" as the tagline. Or A/B by locale.

#### J5 — Privacy policy URL  [Severity: Medium]
**Dev perspective:** `aihomecloud.com/finpath/privacy` is the only URL (login + profile). Must be online, currently dated, GDPR/CCPA compliant if marketing internationally.
**Suggested fix:** Verify URL is live and current. Add cookie/analytics disclosure if any third-party SDKs (Sentry, IAP) collect data.

---

### K — Documentation Drift

#### K1 — Stale "Dual Storage Warning"  [Severity: Medium]
**Dev perspective:** ARCHITECTURE.md L210–217 warns of dual-write divergence between AsyncStorage and SQLite. Reading `context/AppContext.tsx`: writes go to SQLite only (via `dbCreateAsset`/`dbCreateExpense` etc.); AsyncStorage is only for the legacy migration sentinel and the export/import JSON payload. There is no live dual-write. The warning is stale.
**Suggested fix:** Update ARCHITECTURE.md: change the warning to a footnote describing the past state and confirming SQLite is now the single source of truth post-Batch 3 (or whenever the dual-write was removed).

#### K2 — Asset-category list mismatch  [Severity: Medium]
**Dev perspective:** ARCHITECTURE.md L116, FUNCTION_INDEX.md L79 list categories (`STOCKS, GOLD_SILVER, PF, NPS, ESOP_RSU, ...`). The actual UI in `app/(tabs)/assets.tsx:13–26` uses (`EQUITY, MUTUAL_FUND, DEBT, FIXED_DEPOSIT, PPF, EPF, GOLD, REAL_ESTATE, CRYPTO, CASH, ESOP_RSU, OTHERS`). Different vocabulary entirely (no `STOCKS`, no `GOLD_SILVER`, no `NPS`, no `SAVINGS`).
**Suggested fix:** Reconcile. Read the code, update the docs. (See A2 — also fix the code-side duplication.)

#### K3 — `totalNetExpenses` impact downplayed  [Severity: Low]
DECISIONS_AND_LESSONS L20 says "Display-only (core FIRE math unaffected)". This audit found it also affects the projections corpus path (E1). Update lesson.

---

## Deferred / Out of Scope

- **Scheduled vesting + tax modelling (D5 Phase 3)** — too large for one sprint; ship D1+D2+D4 (cliff + half-yearly + currency) first, gather feedback.
- **SQLCipher integration (G1 option a)** — large native work; current threat model doesn't require it.
- **PBKDF2 PIN stretching (G2)** — defer unless we adopt a key-derivation library project-wide.
- **Predictive back (J3)** — cosmetic; revisit when minSdk bumps.
- **Bulk asset import (A5)** — power-user feature; defer until 50+ active users request it.
- **Server-side / cloud sync** — explicit non-goal per ARCHITECTURE.md.
- **Hardcoded IAP price (Known Issue)** — existing kb item; not in scope here.
- **R8 minification (Known Issue)** — APK size only.

---

## Cross-cutting Dependencies

- **C1 must precede D4**: secondary currency on assets is moot if profile.tsx can't even hold all 8 currencies. Fix C1 first.
- **C5 (FX engine) must precede D4 (vesting in foreign currency)**.
- **A2 (single CATEGORIES source) should precede A1 (vesting form)** so the "ESOP_RSU" string is canonical and refactor-safe.
- **E1 (totalNetExpenses fix) is independent** — fix any time; it improves projection accuracy without UI change.
- **B1 (PDF) depends on no other findings** — purely additive.
- **K1, K2, K3 (doc drift)** — fix in same session as the corresponding code.

---

## Suggested Priority Order (if landing in waves)

**Wave 1 — credibility fixes (blocks Play Store / international expansion):**
- J1 (remove storage permissions)
- C1 (unify CURRENCIES across profile screens)
- E1 (fix totalNetExpenses post-retirement)
- K1, K2, K3 (doc drift)

**Wave 2 — tester feedback (currency + reporting):**
- C2 (worldwide currency picker with country search)
- C3 (USD/EUR/GBP short-scale)
- B1 (PDF report with charts)
- B3 (CSV summary block)

**Wave 3 — tester feedback (vesting):**
- A2 (consolidate categories)
- D2 (HALF_YEARLY)
- A1 / D1 (vesting fields in asset form)
- D3 Phase 1 (cliff date)
- C5 (FX engine)
- D4 (vesting amount in foreign currency)

**Wave 4 — UX polish:**
- A3 (quick-add asset)
- F4 (retirement age validation)
- F1, F2 (empty-state guidance)
- I1 (3-step onboarding strip)
- I2, I7 (profile screen consolidation, forgot-PIN messaging)
- G3/G4 (encrypted backup with passphrase)
