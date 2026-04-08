# FinPath Knowledge Base

This folder is the **single source of truth** for FinPath's financial model,
architecture, and design decisions. It exists to prevent:
- LLMs hallucinating or forgetting established assumptions
- Re-litigating decisions already made
- Introducing bugs that were previously fixed

---

## Files

| File | Purpose |
|---|---|
| `FINANCIAL_MODEL.md` | How FIRE calculations work, expense types, pension model, SWR |
| `ARCHITECTURE.md` | Codebase structure, DB schema, data flow, key decisions |
| `DECISIONS_AND_LESSONS.md` | Running log of bugs fixed, edge cases, and non-obvious choices |
| `DEV_ENVIRONMENT.md` | Build machine setup (Mac mini SSH), Ollama models, build commands |
| `TRANSFORM.md` | Full product audit: UX, math bugs, IA, missing features, phased plan |

---

## How to Use

**Before making any change to calculator logic or financial assumptions:**
→ Read `FINANCIAL_MODEL.md` first.

**Before refactoring screens or DB schema:**
→ Read `ARCHITECTURE.md` first.

**When fixing a bug or handling a new edge case:**
→ Add an entry to `DECISIONS_AND_LESSONS.md` explaining what, why, and the fix.

**When starting a new session (LLM or human):**
→ Read all files before touching any financial logic.

**When running build/dev commands:**
→ Read `DEV_ENVIRONMENT.md` — all builds run on Mac mini via SSH.

**Maintenance rule:**
→ Update the relevant kb file after every meaningful code change. Update memory files for infra/tooling changes.
