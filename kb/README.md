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

---

## How to Use

**Before making any change to calculator logic or financial assumptions:**
→ Read `FINANCIAL_MODEL.md` first.

**Before refactoring screens or DB schema:**
→ Read `ARCHITECTURE.md` first.

**When fixing a bug or handling a new edge case:**
→ Add an entry to `DECISIONS_AND_LESSONS.md` explaining what, why, and the fix.

**When starting a new session (LLM or human):**
→ Read all three files before touching any financial logic.
