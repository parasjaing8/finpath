# LLM Analysis — deepseek-coder-v2:16b-lite-instruct-q5_K_S
> Comprehensive workflow guide for hybrid local+cloud LLM development
> Model: deepseek-coder-v2:16b-lite-instruct-q5_K_S via Ollama on Mac Mini M4 16GB
> Last updated: 2026-04-22

---

## Quick reference — routing decision

```
Is the task contained in 1-2 files with a clear spec?     → Local (deepseek)
Does it require understanding 3+ files simultaneously?     → Claude
Does it require judgment about WHAT to do (not just HOW)? → Claude
Is it docs, config, SQL, a single function, or a patch?   → Local always
Is it an audit across a large codebase?                   → Claude
Is it a React Native component with no native modules?    → Local
Does it touch Gradle, signing, or build pipeline?         → Local (good at this)
Is it a novel architectural decision?                     → Claude
```

**Benchmark scores for context (public data):**
- HumanEval (single-function Python): ~78% — comparable to GPT-3.5
- MBPP (Python programming problems): ~75%
- SWE-bench (real GitHub issues, multi-file): ~12% — weak
- Conclusion: reliable for contained tasks, unreliable for cross-file reasoning

---

## Universal system prompt (use for all tasks)

Paste this as the system message in Ollama API calls, Continue.dev config, or any wrapper:

```
You are an expert software engineer. Follow these rules without exception.

OUTPUT FORMAT:
- Output only the requested code or content. No preamble, no explanation after.
- Never truncate with "rest remains the same", "...", or similar.
- If asked for a complete file, output the complete file.
- Never use placeholder comments: // TODO, // implement this, /* ... */, [YOUR CODE HERE]
- When outputting multiple files, use this separator: === FILE: path/to/file.ext ===

CODE QUALITY:
- Use `let` for all mutable variables. Never `const` for state that changes.
- Add event listeners ONCE at module level, never inside functions that repeat.
- When changing an interval/timer speed: clearInterval/clearTimeout first, then restart.
- Store one type per data structure — never mix lookup keys with actual values.
- Every async function must handle errors — try/catch or .catch(), not silent failures.
- Never import from a package without checking it was declared as a dependency first.

MOBILE/REACT NATIVE SPECIFIC:
- Always use hooks (useState, useEffect), never class components unless explicitly asked.
- useEffect cleanup: always return a cleanup function if setting up subscriptions/timers.
- StyleSheet.create() for all styles — never inline style objects in JSX.
- Never use `require()` for assets in new React Native code — use ES6 import.
- Check platform: use Platform.OS or Platform.select() for platform-specific values.

WHEN GIVEN A SPEC:
- If geometry is involved, derive exact values before writing code.
- If an algorithm is described, think through edge cases before coding.
- Check: does every variable that gets mutated use `let` not `const`?
- Check: are all async operations awaited?
```

---

## Workflow 1 — React Native components

### Reliability: HIGH (7/10)
Good for: new screens, UI components, StyleSheet, navigation setup, hooks  
Avoid for: native modules, complex animations, bridging, new architecture (Fabric)

### What it does well
- Component structure (functional components with hooks)
- StyleSheet.create() patterns
- Props typing with TypeScript interfaces
- Basic navigation (React Navigation stack/tab)
- FlatList, ScrollView, basic input patterns
- Platform.OS checks

### Recurring failure patterns

**F1 — Class components instead of hooks**
Model sometimes generates class components, especially for complex state.
```jsx
// Model outputs (wrong for modern RN):
class MyScreen extends Component {
  componentDidMount() { ... }
}
// Should be:
function MyScreen() {
  useEffect(() => { ... }, []);
}
```
Fix in prompt: "Use functional components with hooks only. Never class components."

**F2 — Missing useEffect cleanup**
Subscriptions, timers, and event listeners added in useEffect but cleanup function never returned.
```jsx
// Model outputs (wrong — memory leak):
useEffect(() => {
  const sub = someEmitter.addListener('event', handler);
}, []);
// Should be:
useEffect(() => {
  const sub = someEmitter.addListener('event', handler);
  return () => sub.remove(); // ← model forgets this
}, []);
```
Fix in prompt: "Every useEffect that creates a subscription, timer, or listener MUST return a cleanup function."

**F3 — Inline style objects**
```jsx
// Model outputs (wrong — creates new object every render):
<View style={{ flex: 1, padding: 16 }}>
// Should be:
const styles = StyleSheet.create({ container: { flex: 1, padding: 16 } });
<View style={styles.container}>
```
Fix in prompt: "Never use inline style objects in JSX. Always use StyleSheet.create()."

**F4 — Deprecated AsyncStorage import**
```js
// Model outputs (wrong — deprecated):
import { AsyncStorage } from 'react-native';
// Should be:
import AsyncStorage from '@react-native-async-storage/async-storage';
```
Fix in prompt: "AsyncStorage is NOT from 'react-native'. Import from '@react-native-async-storage/async-storage'."

**F5 — Stale closure in useEffect**
Model adds variables to effect body but misses them in dependency array.
```jsx
// Model outputs (stale closure bug):
useEffect(() => {
  doSomething(userId); // userId used but not in deps
}, []); // ← should be [userId]
```
Fix in prompt: "Every variable from component scope used inside useEffect must appear in the dependency array."

### Prompt template
```
Task: [describe the component]
File: [filename.tsx]
Existing imports available: [list key imports]
Props interface: [describe or paste interface]
Rules: Functional component, hooks only, StyleSheet.create for all styles,
       useEffect cleanup mandatory for any subscription or timer,
       dependency arrays must be complete.
Output: Complete file only. No explanation.
```

---

## Workflow 2 — Android build & Gradle

### Reliability: HIGH (8/10)
Good for: build.gradle changes, signing config, version bumps, dependency additions  
Avoid for: complex Gradle plugin authoring, cross-project dependencies

### What it does well
- `build.gradle` (app and project level) structure
- Signing config blocks
- Dependency declarations (implementation, debugImplementation)
- Version code / version name changes
- ProGuard/R8 rules
- Manifest permissions

### Recurring failure patterns

**F1 — Old Gradle DSL syntax**
```groovy
// Model sometimes outputs (deprecated):
compile 'com.library:name:1.0'
// Should be:
implementation 'com.library:name:1.0'
```

**F2 — Wrong Kotlin DSL vs Groovy DSL**
Model may mix Kotlin DSL (`.kts` files) with Groovy syntax.
```kotlin
// Kotlin DSL (build.gradle.kts) — model may write Groovy:
compileSdkVersion 34  // wrong for .kts
// Should be:
compileSdk = 34
```
Fix in prompt: "This is a [Groovy/Kotlin DSL] build file. Groovy: no = for assignments. Kotlin DSL: uses = and string templates."

**F3 — Outdated library versions**
Model's training data has a cutoff — it may suggest library versions from 2023.
Fix: Always specify "use the version I provide, do not suggest version numbers."

**F4 — Missing signingConfigs fallback**
Model generates signing config but forgets the `buildTypes` reference.
Fix in prompt: "Include both the signingConfigs block AND the reference in buildTypes.release."

### Prompt template
```
Task: [describe the Gradle change]
File: [app/build.gradle or project/build.gradle]
DSL type: Groovy (not Kotlin DSL)
Current content: [paste relevant section]
Do not change: [list sections to preserve]
Output: Only the modified file. No explanation.
```

---

## Workflow 3 — TypeScript / React (web or RN)

### Reliability: MEDIUM-HIGH (6.5/10)
Good for: interfaces, types, generic utilities, single-file logic  
Avoid for: complex generic inference, decorators, module augmentation

### What it does well
- Interface and type definitions
- Generic function signatures
- Utility types (Partial, Pick, Omit, Record)
- Type narrowing with guards
- Enum definitions

### Recurring failure patterns

**F1 — `any` overuse**
Under uncertainty, model defaults to `any` instead of proper types.
Fix in prompt: "Never use `any`. If the type is unknown, use `unknown` and narrow it."

**F2 — Missing return type annotations**
Functions often lack explicit return types.
Fix in prompt: "All functions must have explicit return type annotations."

**F3 — Non-null assertion overuse**
```ts
// Model outputs (unsafe):
const value = obj.property!.nested!.value!;
// Should handle nullable properly
```

**F4 — Inconsistent optional chaining**
Sometimes uses `&&` chains, sometimes `?.`, inconsistently within the same file.

**F5 — Type assertion instead of type guard**
```ts
// Model outputs (unsafe):
const user = data as User;
// Should be:
function isUser(data: unknown): data is User {
  return typeof data === 'object' && data !== null && 'id' in data;
}
```
Fix in prompt: "Never use `as` type assertions. Write proper type guard functions."

---

## Workflow 4 — Node.js / Express backend

### Reliability: HIGH (7.5/10)
Good for: REST endpoints, middleware, request validation, basic auth  
Avoid for: complex streaming, WebSocket servers, distributed systems design

### What it does well
- Express route handlers (correct structure)
- Middleware chaining
- async/await with try/catch
- Request/response typing
- Basic JWT patterns
- Environment variable usage

### Recurring failure patterns

**F1 — Missing await on async operations**
```js
// Model outputs (bug — unhandled promise):
router.get('/users', async (req, res) => {
  const users = db.query('SELECT * FROM users'); // missing await
  res.json(users);
});
```
Fix in prompt: "Every database call, file operation, and external API call MUST be awaited."

**F2 — Error not passed to next()**
```js
// Model outputs (error swallowed, request hangs):
router.get('/data', async (req, res) => {
  try {
    const data = await fetchData();
    res.json(data);
  } catch (err) {
    console.error(err); // ← doesn't send response or call next(err)
  }
});
// Should be: next(err) or res.status(500).json({error: ...})
```

**F3 — No input validation**
Model generates endpoints that trust req.body directly without validation.
Fix in prompt: "Validate all req.body fields before using them. Check types and required fields explicitly."

**F4 — CORS and security headers forgotten**
Unless explicitly asked, model omits helmet(), cors(), rate limiting.
Fix in prompt: "Include helmet() and cors() middleware in any Express app setup."

---

## Workflow 5 — SQL & database

### Reliability: HIGH (8/10)
Good for: SELECT/INSERT/UPDATE/DELETE, JOINs, indexes, basic migrations  
Avoid for: complex window functions, CTEs with mutations, database-specific advanced features

### What it does well
- Standard CRUD queries
- JOIN syntax (INNER, LEFT, RIGHT)
- Aggregations (GROUP BY, HAVING)
- Index creation
- Migration file structure
- Foreign key constraints

### Recurring failure patterns

**F1 — N+1 query pattern**
Model generates code that queries inside a loop instead of a single JOIN.
```js
// Model outputs (N+1 bug):
const users = await db.query('SELECT * FROM users');
for (const user of users) {
  user.orders = await db.query('SELECT * FROM orders WHERE user_id = ?', [user.id]);
}
// Should be a single JOIN query
```

**F2 — Missing transaction wrapping**
Multi-step operations that should be atomic are written without BEGIN/COMMIT.
Fix in prompt: "Any operation that modifies more than one table must use a transaction."

**F3 — SQL injection via string concatenation**
Occasionally model concatenates user input into query strings.
Fix in prompt: "Always use parameterized queries ($1, $2 or ?) — never concatenate user input into SQL strings."

**F4 — Wrong NULL handling**
Uses `= NULL` instead of `IS NULL`.

---

## Workflow 6 — Test writing (Jest / React Testing Library)

### Reliability: MEDIUM (5.5/10)
Good for: test structure, basic assertions, mock setup  
Avoid for: integration tests, complex async flows, snapshot testing strategy

### What it does well
- describe/it/expect structure
- Basic mock setup with jest.fn()
- beforeEach/afterEach cleanup
- Simple async test patterns

### Recurring failure patterns

**F1 — Tests the mock, not the behavior**
```js
// Model outputs (tests nothing real):
jest.mock('../api', () => ({ fetchUser: jest.fn().mockResolvedValue(mockUser) }));
it('fetches user', async () => {
  const result = await fetchUser(1);
  expect(fetchUser).toHaveBeenCalledWith(1); // only tests the mock was called
  // Never tests what the component does with the result
});
```
Fix in prompt: "Test observable behavior and output, not that mocks were called."

**F2 — Missing act() wrapper for state updates**
```jsx
// Model outputs (React warning):
fireEvent.press(button);
expect(screen.getByText('Updated')).toBeTruthy(); // may fail without act()
// Should wrap in: await act(async () => { ... })
```

**F3 — Over-mocking**
Model mocks dependencies that should be tested (e.g., mocks the component being tested).
Fix in prompt: "Only mock: network calls, device APIs, timers. Do NOT mock the module under test."

**F4 — No edge case coverage**
Model writes happy-path tests only. Empty states, error states, loading states not tested.
Fix in prompt: "Write tests for: happy path, empty/null input, error state, loading state."

**F5 — Async not properly awaited in RTL**
```js
// Model outputs (test passes before assertion runs):
it('shows data', () => {
  render(<MyComponent />);
  expect(screen.getByText('Loaded')).toBeTruthy(); // data not loaded yet
  // Should use: await screen.findByText('Loaded')
});
```

---

## Workflow 7 — Documentation & Markdown

### Reliability: VERY HIGH (9/10)
This is the safest task for local LLMs. Strongly prefer local for all doc work.

### What it does well
- README structure
- JSDoc / TSDoc comments
- API documentation
- CHANGELOG entries
- Architecture decision records
- Code comments explaining WHY (when asked)

### Recurring failure patterns

**F1 — Over-documents obvious things**
Adds JSDoc to every getter/setter including trivial ones.
Fix in prompt: "Only document non-obvious functions. Skip getters, setters, and self-explanatory helpers."

**F2 — Outdated version numbers in examples**
Fix in prompt: "Do not include version numbers in code examples unless I specify them."

**F3 — Hallucinated API references**
When documenting something it doesn't know, model invents plausible-sounding API names.
Fix in prompt: "If you are unsure about an API or library detail, write [VERIFY THIS] instead of guessing."

---

## Workflow 8 — Shell scripts & DevOps

### Reliability: MEDIUM-HIGH (7/10)
Good for: build scripts, deployment scripts, cron jobs, file operations  
Avoid for: complex sed/awk pipelines, cross-platform scripts (Linux vs macOS differences)

### What it does well
- Basic bash scripting
- File operations (cp, mv, mkdir -p, find)
- Git commands
- Environment variable handling
- Simple conditionals and loops

### Recurring failure patterns

**F1 — Unquoted variables (word splitting)**
```bash
# Model outputs (breaks on paths with spaces):
cp $SOURCE $DEST
# Should be:
cp "$SOURCE" "$DEST"
```
Fix in prompt: "Always quote variables: \"$VAR\" not $VAR. No exceptions."

**F2 — No error handling**
Scripts proceed even when commands fail.
Fix in prompt: "Begin every script with: set -euo pipefail"

**F3 — macOS vs Linux differences ignored**
`sed -i` on macOS requires `sed -i ""`, model writes Linux syntax.
`date` flags differ between macOS and GNU date.
Fix in prompt: "This script runs on macOS (not Linux). Use BSD/macOS-compatible commands."

**F4 — Hardcoded paths**
```bash
# Model outputs:
cd /home/user/project
# Should use:
cd "$(dirname "$0")"  # or $HOME/project
```

---

## Workflow 9 — Config files (JSON, YAML, Gradle, package.json)

### Reliability: HIGH (8/10)
Good for: structured config edits, adding fields, schema-compliant changes  
Avoid for: complex Gradle transforms, multi-document YAML

### Recurring failure patterns

**F1 — JSON comments**
Adds `// comment` to JSON files (invalid JSON).
Fix in prompt: "JSON does not support comments. Do not add any."

**F2 — YAML indentation errors**
Inconsistent 2 vs 4 space indentation causing parse failures.
Fix in prompt: "Use exactly 2-space indentation throughout. No tabs."

**F3 — package.json peer dependency conflicts**
Suggests package versions that conflict with existing ones.
Fix in prompt: "Do not suggest version numbers. I will fill in versions. Write '\"package\": \"VERSION\"' as placeholder."

---

## Workflow 10 — Code review & audit

### Reliability: MEDIUM (5/10)
Route to Claude unless the file is small and self-contained.

### What it does well
- Spotting obvious bugs in small files (<200 lines)
- Identifying missing null checks
- Flagging console.log left in production code
- Basic security issues (SQL injection, XSS patterns)

### Recurring failure patterns

**F1 — Misses cross-file issues**
Cannot see that a function's behavior breaks because of how a different file calls it.
**Always route multi-file audits to Claude.**

**F2 — Hallucinated issues**
Reports bugs that don't exist, especially in complex async code.
Fix: ask for issues with evidence: "For each issue, quote the exact line that is wrong."

**F3 — Misses subtle race conditions**
Concurrent state updates, event ordering issues — not reliably caught.

**F4 — Incomplete severity ranking**
Ranks style issues as high severity and actual bugs as low. 
Fix in prompt: "Rank issues: CRITICAL (data loss/crash), HIGH (wrong behavior), MEDIUM (edge case), LOW (style)."

---

## Workflow 11 — Refactoring

### Reliability: MEDIUM (5.5/10)
Good for: extracting a function, renaming, simple restructure of one file  
Avoid for: cross-file refactors, changing data flow between components

### What it does well
- Extracting a repeated block into a function
- Renaming variables consistently within a file
- Converting class component to functional (single file)
- Splitting one large function into smaller ones

### Recurring failure patterns

**F1 — Changes behavior while refactoring**
Model "cleans up" code and silently removes edge case handling.
Fix in prompt: "This is a pure refactor. Do NOT change any behavior. Do NOT remove any logic, even if it looks redundant."

**F2 — Misses all call sites**
Renames a function but misses some callers (can't see across files).
**Always route cross-file renames to Claude or do manually.**

**F3 — Adds abstractions not requested**
Refactoring one function leads model to suggest rewriting three others.
Fix in prompt: "Refactor ONLY the specified function. Do not touch anything else."

---

## Workflow 12 — HTML / Canvas games (benchmark findings)

### Reliability: MEDIUM (6/10 with good prompts, 3/10 without)

### Key bugs (from direct benchmark, 2026-04-21)
See full details in game section, summary:
1. `const` for mutable state → TypeError crash
2. Event listeners inside game loop → thousands of listeners
3. `canvas.addEventListener('keydown')` → keyboard never works
4. Direction buffer never applied to actual direction → uncontrollable
5. Geometric formulas wrong (pipe gap = 0) → unplayable
6. `setInterval` not restarted on speed change → speed display only
7. 3 separate random calls in one constructor → mismatched properties
8. Board stores values but drawBoard does key lookup → white cells
9. Undefined variable reference → runtime crash on first interaction
10. Wrong destructuring `[x,y]` from `{x,y}` → undefined coords
11. Tile positioning inside `display:grid` → absolute position ignored
12. Merge doesn't call score update → score always 0
13. Game loop stops in dead state → can't restart
14. Score increment on pipe exit not pipe pass → wrong timing

---


## Workflow 13 — Single-file Webapp Generation

### Reliability by model + approach
| Approach | Model | Rating |
|---|---|---|
| Single 9k-char prompt | deepseek-coder-v2:16b | 1/10 — skeleton, quits |
| 6 atomic stages (<2k each) | deepseek-coder-v2:16b | untested |
| 6 atomic stages (<2k each) | qwen3.5:9b | 6.5/10 — all stages finish, 3/6 bug-free |
| Full implementation | Claude sonnet-4.6 | 9/10 — needs post-audit |

**Complexity ceiling (confirmed 2026-04-22):**
- Prompt >~9,000 chars (~3,000 tokens) → deepseek generates a skeleton and stops
- `finish_reason=stop` fires at ~10% of the available token budget (1,338/14,000 tokens used)
- Model produces 1-2 partial sections then emits a placeholder comment and halts
- No error, no truncation warning — it just quits cleanly but silently
- Reproducible regardless of `max_tokens` setting above ~4,000

### What deepseek does well (small webapps)
- Dark theme CSS (accurate variable system, flex layout)
- Single-purpose tool with 1 input → 1 output
- Chart.js integration for simple line/bar charts
- Indian number formatting, currency symbols
- Basic slider↔input bidirectional sync

### Recurring failure patterns

**W1 — Complexity ceiling: skeleton + early stop**
For prompts with 3+ modules, the model generates a partial first module then stops.
```
// Output (actual deepseek output for 4-module SIP planner, 9,315 char prompt):
<div id="tab-sip">...</div>  <!-- only tab 1 partially filled -->
<!-- TODO: implement remaining tabs -->
// finish_reason=stop at 1,338 tokens / 14,000 budget
```
Fix: Break into 1 module per prompt, assemble manually. Or route to Claude for anything >2 modules.

**W2 — Calculation formula drift**
Model uses simplified/wrong financial formulas unless given exact pseudocode.
```js
// Wrong (model output):
const fv = sip * Math.pow(1 + rate, years);   // lumpsum formula applied to SIP

// Correct:
const fv = sip * ((Math.pow(1+r, n) - 1) / r) * (1 + r);  // annuity-due
```
Fix: Include exact formula in prompt as pseudocode or code. Never say "standard SIP formula".

**W3 — Chart.js color conversion bug**
When using hex colors, model writes `.replace('rgb','rgba')` which is a no-op on hex strings.
```js
// Wrong (model output):
backgroundColor: fill ? color.replace(')',',0.15)').replace('rgb','rgba') : 'transparent'
// '#7c4dff' is unchanged — fill shows as solid opaque

// Correct:
function hexToRgba(hex, a) {
  const r=parseInt(hex.slice(1,3),16), g=parseInt(hex.slice(3,5),16), b=parseInt(hex.slice(5,7),16);
  return `rgba(${r},${g},${b},${a})`;
}
```
Fix: Provide the hexToRgba helper in prompt or specify rgba() colors directly.

**W4 — Stacked chart missing y-axis flag**
Model creates two filled Chart.js datasets but forgets `stacked: true` on the y-axis scale.
Result: datasets overlap instead of stacking, total corpus invisible.
Fix: Add to prompt: "For stacked area charts, set `scales.y.stacked = true`."

**W5 — Tab switching doesn't trigger initial calc**
Model adds `oninput` handlers but tabs 2-4 start with `—` because calc is never called on `sw()`.
Fix: Specify in prompt: "Call each tab's calc function at the end of the sw() tab-switch handler."


---

### Qwen3.5:9b benchmark (2026-04-22) — 6 atomic stages

**Setup:** 6 prompts, each <2k chars, each a self-contained artifact. `think: false` + `/no_think` in system prompt. Max 4k tokens per stage.

**Results:**
| Stage | Task | Tokens | Time | Result |
|---|---|---|---|---|
| 1 | CSS | 1,938 | 157s | ✅ Perfect — all variables, all classes, responsive |
| 2 | HTML body | 2,880 | 235s | ⚠️ Bugs — truncated Tab 4, missing .cards wrapper, .cw outside .rp |
| 3 | JS helpers | 902 | 72s | ✅ Correct — fmt, sync, hexToRgba, mkDs, mkChart, sw all work |
| 4 | SIP + Stepup calcs | 845 | 68s | ✅ Correct — formulas exact, no drift |
| 5 | Lumpsum + Full calcs | 1,770 | 140s | ⚠️ Bug — `g(id).value` double-dereference |
| 6 | Expense UI + boot | 387 | 32s | ⚠️ Bug — `if condition return` missing parens (syntax error) |

**Total:** 8,722 tokens · 704 seconds · all finish=stop (no complexity ceiling)

**Key contrast with deepseek:** deepseek quit at 1,338 tokens on a 9k prompt; Qwen3.5 completed all 6 stages and produced working code on 3 of 6 with fixable bugs on the other 3.

### Qwen3.5-specific failure patterns

**Q1 — HTML structural truncation on long tab layouts**
Even with 4k token budget, model truncates the HTML when generating 4 tabs × 5 inputs each. Tab 4 input panel cut off mid-element. Missing result panels for tabs 3–4.
```html
<!-- Actual output — cut off inside Tab 4: -->
<input type="day" type="number" id="n-ls4" ...>
</   ← truncated here, <script> starts immediately
```
Fix: Split HTML into 1-tab-per-prompt. Or provide a complete HTML skeleton and ask model to fill inputs only.

**Q2 — Double-dereference: `g(id).value` on helper that already returns float**
Model recognizes the `g()` helper but then appends `.value` as if it's still a DOM element.
```js
// Wrong (Qwen3.5 output):
const ls = g('n-ls3').value;   // g() returns parseFloat(...) — .value = undefined

// Correct:
const ls = g('n-ls3');
```
Fix: In the helpers prompt, add: "g(id) returns a number, not a DOM element. Never call .value on g()."

**Q3 — Python-style if without JS parentheses**
Model writes if-conditions without wrapping parens, which is a JS syntax error.
```js
// Wrong (Qwen3.5 output):
if expenses.length >= 10 return    // SyntaxError

// Correct:
if (expenses.length >= 10) return;
```
Fix: Add to system prompt: "All JavaScript `if` statements MUST have parentheses: `if (condition)`."

**Q4 — JSON.stringify for inline event handler string literals**
In renderExpRows, model generates oninput attributes using JSON.stringify for field names.
```js
// Wrong (Qwen3.5 output):
oninput="updExp('+e.id+','+JSON.stringify(['year'])+',this.value)"
// Produces: oninput="updExp(1,["year"],this.value)" — array, not string

// Correct:
oninput="updExp('+e.id+',\'year\',this.value)"
```
Fix: In expense UI prompt, provide exact innerHTML string template with escaped quotes.


### Qwen3.5:9b v2 benchmark (2026-04-22) — 9 atomic stages + refined system prompt

**Changes from v1:** system prompt + Q2/Q3 fix rules; HTML split into 4 × one-tab stages; exact innerHTML template for Stage 6.

**Results:**
| Stage | Task | Tokens | Time | Result |
|---|---|---|---|---|
| 1 | CSS | 1,938 | 156s | ✅ Perfect (same as v1) |
| 2a | Tab 1 HTML | 696 | 55s | ✅ Complete, no truncation |
| 2b | Tab 2 HTML | 845 | 67s | ✅ Complete, no truncation |
| 2c | Tab 3 HTML | 998 | 78s | ✅ Complete, no truncation |
| 2d | Tab 4 HTML | 1,074 | 84s | ✅ Complete + expense section |
| 3 | JS helpers | 780 | 62s | ✅ Correct |
| 4 | SIP + Stepup calcs | 792 | 63s | ✅ Correct |
| 5 | Lumpsum + Full calcs | 1,650 | 133s | ✅ Correct — g() used without .value |
| 6 | Expense UI + boot | 400 | 33s | ⚠️ 2 bugs — field name values vs strings; missing let |

**Total:** ~9,173 tokens · 731 seconds · all finish=stop

**Bug scorecard vs v1:**

| Bug | v1 | v2 | Fix method |
|---|---|---|---|
| Q1 HTML truncation | ❌ | ✅ Fixed | Split into 4 single-tab stages |
| Q2 g().value | ❌ | ✅ Fixed | Explicit rule in system prompt |
| Q3 if without parens | ❌ | ✅ Fixed | Explicit rule in system prompt |
| Q4 string literals in oninput | ❌ | ⚠️ Partial | No JSON.stringify but field values used |
| Q5 implicit globals (missing let) | — | ⚠️ New | Strict mode: container/div/e undeclared |
| Q6 cross-stage let redeclaration | — | ⚠️ New | expenses/expenseId declared in both stage 3 & 6 |

**Post-generation work:** v1 needed 3 full stage rewrites. v2 needed 3 targeted line fixes. ~80% reduction.

**New failure patterns from v2:**

**Q5 — Implicit globals in strict mode**
Model omits `let`/`const` on local loop variables inside functions.
```js
// Wrong (Qwen3.5 v2):
function renderExpRows() {
  container = el('exp-rows');   // ReferenceError in 'use strict'
  expenses.forEach(e => {
    div = document.createElement('div');  // ReferenceError

// Correct:
  let container = el('exp-rows');
    let div = document.createElement('div');
```
Fix: Add to system prompt: "Every variable declaration inside a function MUST use `let`. No bare assignments."

**Q6 — Cross-stage `let` redeclaration**
When assembling multiple stage outputs, shared state variables declared in Stage 3 (helpers) are re-declared in Stage 6 (expense UI), causing `SyntaxError: Identifier already declared` in strict mode.
```js
// Stage 3 already has:
let expenses = [];
let expenseId = 0;

// Stage 6 re-emits:
let expenses = [];   // SyntaxError
let expenseId = 0;
```
Fix: Tell Stage 6 explicitly: "Do NOT declare `expenses` or `expenseId` — they are already declared. Just use them."

**Q4 (refined) — Variable value used as field name string**
Even with an exact template provided, model interpolates the variable VALUE instead of the field name literal.
```js
// Exact template given in prompt:
oninput="updExp(' + e.id + ',\'year\',this.value)"

// Model output:
oninput="updExp(' + e.id + ',' + e.year + ',this.value)"
// Result: updExp(1, 5, val) — field is 5 (year value), not 'year'
```
Fix: In Stage 6 prompt, write the escaped string directly and instruct: "Copy this innerHTML string VERBATIM — do not substitute e.year, e.amount, or e.label for the field name strings."

**Revised routing for Qwen3.5:9b with v2 prompt:**
- CSS, HTML (per-tab), helpers, financial calcs: reliable with correct prompts
- Expense UI / complex string interpolation: still needs post-generation review
- After v2 refinements: expect 1–2 small fixable bugs max (down from 3 full stage failures in v1)

### Routing decision
| Webapp complexity | Route to |
|---|---|
| 1 module, 1-3 inputs, no chart | deepseek |
| 1 module + 1 chart | deepseek (give exact formula) |
| 2 modules | deepseek (give exact formulas, 1 prompt per module) |
| 3+ modules, or any stacked/annotated chart | Claude |
| Module with expense/event management UI | Claude |

### Prompt template (single-module tool)
```
Create a self-contained HTML file. No external scripts except Chart.js CDN.

DARK THEME: bg #0f0f1a, card #1a1a2e, input bg #252540, border #333355,
accent #7c4dff, cyan #00bcd4, text #e0e0e0, muted #888899, gain #4caf50, loss #f44336.

INPUT: [describe each input with min/max/step/default]
Each input: label row + range slider + number input, bidirectionally synced:
  slider.oninput = () => { numInput.value = slider.value; calculate(); }
  numInput.oninput = () => { slider.value = numInput.value; calculate(); }

FORMULA (implement exactly):
[write formula as pseudocode or JS]

CHART: Line chart, x = [describe axis], datasets:
  - "[name]" (#7c4dff, fill rgba(124,77,255,0.15)): [describe data]
  - "[name]" (#00bcd4, no fill): [describe data]
Chart options: legend color #e0e0e0, grid color #333355, tick color #888899.
Destroy old chart before recreating: if(chart) chart.destroy(); chart = new Chart(...)

RESULTS: 3 stat cards — label (muted), value (white/#4caf50/accent).
Currency: ₹ + Math.round(v).toLocaleString('en-IN')

Rules: let not const for state; all calcs on oninput; output starts with <!DOCTYPE html>.
Additional rules for Qwen3.5 (add to every prompt):
  - All if statements MUST use parentheses: if (condition) — never Python-style
  - g(id) returns a number, not a DOM element — never write g(id).value
  - No JSON.stringify for string literals in inline event handlers
  - Every variable inside a function MUST use let: let x = ... (no bare assignments)
  - Multi-stage assembly: do NOT redeclare variables already declared in prior stages
```

---

## Polished prompt templates by task type

### Single-file patch
```
File: [path/filename.ext]
Task: Fix [specific bug description]
Root cause: [what you already know]
Constraint: Change ONLY what is needed to fix this. Do not refactor anything else.
Output: Complete corrected file. No explanation.
```

### New React Native screen
```
Task: Create a new screen: [ScreenName]
File: src/screens/[ScreenName].tsx
Navigation: receives params [list params]
Data: fetches from [describe API or local store]
Rules:
  - Functional component with hooks only
  - StyleSheet.create() for all styles
  - useEffect cleanup for any subscription or timer
  - All dep arrays complete
  - Handle loading state, error state, empty state
  - TypeScript: explicit types, no `any`
Output: Complete file. No explanation.
```

### Gradle change
```
File: android/app/build.gradle (Groovy DSL, not Kotlin)
Task: [describe change]
Current relevant section:
[paste section]
Rules:
  - Use `implementation` not `compile`
  - Do not change versionCode or versionName unless asked
  - Do not add/remove any other dependencies
Output: Complete modified file. No explanation.
```

### SQL query
```
Database: [PostgreSQL / SQLite / MySQL]
Task: Write a query that [describe what you need]
Tables: [paste CREATE TABLE statements or describe columns]
Rules:
  - Parameterized queries only ($1, $2 / ?)
  - Include an index suggestion if the query would benefit from one
  - If multiple tables are modified, wrap in a transaction
Output: SQL only. No explanation.
```

### Test file
```
File to test: [path/component.tsx]
Test file: [path/component.test.tsx]
Framework: Jest + React Testing Library
Rules:
  - Test observable behavior, not implementation details
  - Mock ONLY: network calls, device APIs (camera/location), timers
  - Do NOT mock the component under test
  - Cover: happy path, error state, empty/null input, loading state
  - Async interactions: use findBy* or waitFor, not getBy*
Output: Complete test file. No explanation.
```

### Documentation
```
Task: Write [JSDoc / README section / inline comments] for [describe target]
Rules:
  - Document the WHY, not the WHAT (code shows what, comments explain why)
  - Skip obvious functions (getters, simple setters, trivial helpers)
  - Write [VERIFY THIS] for any detail you are uncertain about
  - No version numbers in examples
Output: Documentation only. No explanation.
```

### Shell script
```
Platform: macOS (BSD commands, not GNU/Linux)
Task: Write a script that [describe]
Rules:
  - First line: #!/bin/bash
  - Second line: set -euo pipefail
  - Always quote variables: "$VAR" not $VAR
  - Use $HOME not /home/username
Output: Script only. No explanation.
```

---

## Routing cheat sheet

| Task | Local (deepseek) | Local (qwen3.5:9b) | Claude |
|---|---|---|---|
| New RN component, 1 file | ✓ | ✓ | |
| Multi-screen feature | ✓ | | |
| Cross-file refactor | | | ✓ |
| Gradle change | ✓ | ✓ | |
| SQL query | ✓ | ✓ | |
| Migration file | ✓ | | |
| Write unit tests | ✓ | ✓ | |
| Integration test strategy | | | ✓ |
| Documentation | ✓ | ✓ | |
| Architecture decision | | | ✓ |
| Codebase audit (large) | | | ✓ |
| Single-file audit (<200 lines) | ✓ | | |
| Debug complex race condition | | | ✓ |
| Shell script | ✓ | ✓ | |
| Simple patch, clear spec | ✓ | ✓ | |
| HTML game / canvas | ✓ (with template) | | |
| Single-module webapp (<2 inputs, 1 chart) | ✓ (give exact formula) | ✓ | |
| Multi-module webapp (3+ tabs, atomic stages) | | ✓ (6 stages, expect 3/6 bugs) | |
| Multi-module webapp (zero-bug target) | | | ✓ |
| Webapp with complex state (expenses, events) | | ✓ (expense UI needs exact template) | |

**Rule of thumb:** if you can fully describe the task in 5 sentences without referencing another file — local. If you need to say "like it works in file X" — Claude.

---

## Known deepseek-coder-v2:16b strengths (what NOT to route to Claude)

1. Any self-contained algorithmic problem
2. Standard CRUD (model, query, endpoint, test) if you specify the schema
3. StyleSheet / CSS / layout (usually pixel-perfect)
4. Config file edits (build.gradle, package.json, tsconfig)
5. Documentation — strongest category, near Claude quality
6. Boilerplate that follows a clear pattern (new screen, new endpoint)
7. SQL queries with provided schema
8. Shell scripts with explicit rules

---

## Setup checklist for reliable local LLM use

- [ ] System prompt from this doc loaded in Ollama wrapper or Continue.dev
- [ ] Per-task prompt templates saved as slash commands
- [ ] TypeScript compiler run after every generated file (catches ~40% of bugs immediately)
- [ ] Never accept first output without at least reading the key logic
- [ ] For any generated loop/interval: verify the variable being iterated is correct type
- [ ] For any async function: verify every await is present
- [ ] For React components: verify useEffect dep arrays are complete

---

## Community resources to pull from (ranked by signal quality)

1. **Aider system prompts** (github: aider-chat/aider, folder: aider/coders/)
   — Best published prompts for code generation format discipline

2. **Continue.dev prompt library** (hub.continue.dev)
   — Community slash commands and context providers

3. **SWE-bench leaderboard** (swebench.com)
   — Shows which models handle multi-file real tasks — deepseek-coder-v2 at ~12%

4. **Aider LLM leaderboard** (aider.chat/docs/leaderboards)
   — Code editing benchmark specifically. More relevant than HumanEval for real work.

5. **OpenHands agent prompts** (github: All-Hands-AI/OpenHands)
   — Production-tested autonomous coding agent prompts

---

*Last updated: 2026-04-22 (Workflow 13 + Qwen3.5 v1+v2 benchmarks added) | Mac Mini M4 16GB | deepseek-coder-v2:16b + qwen3.5:9b via Ollama*
