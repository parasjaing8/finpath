# Finpath -- Decisions & Lessons

Architectural decisions, bugs fixed, and lessons learned. Add an entry whenever something non-obvious is decided or discovered.

---

## 2026-04-09 -- Date picker rewrite (pure JS)

Replaced `@react-native-community/datetimepicker` with pure-JS bottom-sheet modal (`components/DateInput.tsx`) using ScrollView columns for Day/Month/Year. Zero native deps.

---

## 2026-04-09 -- Tab reorder + rename

Tab order: Assets -> Expenses -> Goal -> Dashboard -> Profile. "Plan" tab renamed to "Goal". Tried Dashboard-first, reverted to Assets-first.

---

## 2026-04-09 -- Asset category crash fix

`resetForm()` in assets.tsx called `setExpectedRoi()`, `setGoldSilverUnit()`, `setGoldSilverQuantity()` -- none declared. Removed dead setter calls.

---

## 2026-04-09 -- withReleaseSigning.js idempotency fix

Plugin guard checked `'finpath-release.jks'` (never in build.gradle) -- changed to `'keystorePropertiesFile'`.

---

## 2026-04-09 -- signingConfig plugin limitation (known issue)

Step-3 regex in withReleaseSigning.js fails to patch buildTypes.release from signingConfigs.debug to the conditional. Manual sed required after every clean prebuild. TODO: fix the regex.

---

## 2026-04-09 -- Package name preserved: com.anonymous.finpath

Changing package name = different app on Android. Sideload users lose data. Keep as-is unless starting from scratch.

---

## 2026-04-09 -- New Architecture enabled

`newArchEnabled: true` in app.json (Fabric + TurboModules). If a new package causes crashes, check this first.

---

## 2026-04-08/09 -- Two-Bucket Growth Model

existingBucket (current assets, blended rate) + sipBucket (SIP, sipReturnRate). Merge at retirement. Bug fixed: sipStopAge == retirementAge was dropping last SIP.

---

## 2026-04-09/10 -- UX overhaul (r7-r13)

- CorpusPrimer onboarding dialog on Goals screen
- Dashboard redesign: corpus tiles, collapsible Advanced, SIP burden warning
- Goals: "Monthly Retirement Withdrawal" (was "Pension"), FIRE type chips, removed save alert
- Per-asset ROI slider removed (uses DEFAULT_GROWTH_RATES)
- Gold/Silver grams mode removed
- Expenses: plain-language type labels with hints
- SIP engine: FV annuity formula, current-year proration
- Logout moved from Dashboard header to Profile page

---

## 2026-04-11 -- Monetization: single-app + IAP (DONE)

Single app. One IAP (finpath_pro, Rs.199/$4.99). CSV export only paid feature. Profiles fully free. Old 2-app strategy abandoned. Commit eb1fdcb removed all Pro gates from login.tsx, create-profile.tsx, ProPaywall.tsx (reason prop removed, "Unlimited profiles" feature removed).

---

## 2026-04-06 -- Pension is corpus withdrawal, not external income

Pension = monthly amount user withdraws from own corpus post-retirement. Not govt pension, not rental income. FIRE corpus = pension/SWR.

---

## 2026-04-06 -- Expense funding rules

CURRENT_RECURRING: salary-funded, stops at retirement. FUTURE_ONE_TIME/FUTURE_RECURRING: corpus-funded if post-retirement.

---

## 2026-04-06 -- PIN in SecureStore, not SQLite

SQLite readable on rooted devices. PINs stored as salt$sha256(salt+pin) in expo-secure-store. Legacy bare-SHA256 also supported for migration.

---

## 2026-04-06 -- FLAG_SECURE app-wide

Applied at Activity level in MainActivity.kt. No screenshots, no recent-apps preview. By design for financial data.

---

## 2026-04-06 -- Date parsing: local time, not UTC

Always use `new Date(year, month - 1, day)` for local time. String parsing (`new Date(string)`) gives UTC and causes off-by-one in negative UTC offsets.

---

## 2026-04-13 -- FIRE engine: SWR formula replaced with simulation-based corpus

SWR formula (withdrawal / SWR%) was calibrated for US equity markets (4–7% real return). Indian market reality: at 7% postSipReturnRate and 6% pension inflation, real return = 1%. SWR 5% depleted corpus at age 74 instead of 100 — fireCorpus was ₹8.16 Cr while simulation correctly required ₹15+ Cr.

Fix: `calculateSimulationFireCorpus()` in `calculator.ts` — binary search (low=0, high=₹200 Cr, tolerance=₹10K) finding minimum corpus at retirement age such that post-retirement simulation survives to `fire_target_age`. For "Rich" type: corpus at target age ≥ starting corpus (wealth preservation).

`simulatePostRetirementCorpus()` is UNCLAMPED (no Math.max(0,...)) so binary search converges correctly on the exact depletion point.

---

## 2026-04-13 -- FIRE type repurposed: SWR% → survival age

SWR% is meaningless to most users and miscalibrated for India. Repurposed FIRE type chips to encode survival ages:
- Lean (slim): 85 yrs
- Comfortable (moderate): 100 yrs
- Rich (fat): 120 yrs

DB keys (slim/moderate/fat) unchanged — no migration needed. `fire_target_age` field in goals DB now stores 85/100/120. `FIRE_TARGET_AGES` constant replaces `FIRE_WITHDRAWAL_RATES` in calculator.ts.

---

## 2026-04-13 -- failureAge added to CalculationOutput

`failureAge: number` — first post-retirement year where corpus goes negative in projection loop (-1 if corpus survives to end of projections). Used in: dashboard hero card pill ("⚠ Runs out at N"), chart red depletion dot, and corpus depletion warning card.

---

## 2026-04-13 -- Dashboard UX redesign: hero card + inflation insight + bell curve

Old: 6 tiles across 3 rows (SIP, Freedom Age, Goal Status, Today/Projections). Confusing — eyes had no focal point. Inflation insight (why the corpus target is what it is) was completely absent.

New layout:
1. Hero card (dark green #1B5E20): large SIP amount, retirement age, On Track/Off Track pill, survival pill. All identity signals in one place.
2. Inflation insight card (amber): "Why ₹X Cr? — ₹1L/month today = ₹3.2L/month at age 50 (6% inflation, 21 yrs)". The single most important explainer in the app.
3. Snapshot row: TODAY (investable NW, green) + AT AGE N (projected corpus, purple). Clean contrast, no clutter.
4. Chart simplified: removed red withdrawal line (was confusing) and orange dashed FIRE line (redundant after simulation fix). Now: single bell curve + green dashed retirement marker + optional red depletion dot.
5. SIP slider feedback: human outcome ("retire 1 yr earlier") instead of technical params ("Returns 12%→7%·Step-up off").

Color system: green (#1B5E20) = identity/current/positive; purple (#5E35B1) = future/projection; amber (#F9A825) = insight/read-me; red (#C62828) = warning/depletes. Cascades from hero card throughout page.

---

## 2026-04-13 -- Goals page: inflation slider + future value hint

`inflation_rate` field and DB save existed in goals, but had no UI. Added 3–12% integer slider.

Future value hint: amber card below withdrawal TextInput. Shows inflated monthly withdrawal at retirement age in real time as user adjusts withdrawal amount, inflation rate, or retirement age. Grounds the corpus target before user reaches Dashboard.

---

## 2026-04-13 -- Python JSX replacement: closing tag ambiguity (lesson)

When using Python `content.find('          </View>', start)` to find a JSX closing tag, if the block contains conditional JSX rendering `</View>` at the same indent, the find can stop at the wrong position. The new block is inserted correctly but the tail of the old block remains as orphaned content.

Rule: always use a LONGER, unique end marker including content after the closing tag (e.g., `'          </View>\n        </Card.Content>'`). Or match the entire old block as a string literal. Always `sed -n "N,Mp"` spot-check the modified area before building.

---

## 2026-04-13 -- Dropbox not mounted on Mac mini in SSH sessions

`/Volumes/Dropbox/` is absent in non-interactive SSH sessions (Dropbox client mounts only when GUI is active). Copy AAB/APK via scp FROM Windows (pull) instead of cp from Mac (push):
```
scp parasjain@192.168.0.130:~/finpath/android/.../app-release.aab "C:\dropbox\finpath\app-release.aab"
```
