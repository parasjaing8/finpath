---
name: KB Maintenance Rule
description: Always update kb/ md files and memory when code changes happen; kb is the single source of truth
type: feedback
---

After any code change, update the relevant kb/ file(s) and memory entries to reflect the new state.

**Why:** The kb/ folder and memory system are the single source of truth for the project. Stale docs cause LLM hallucinations and re-litigated decisions.

**How to apply:**
- Bug fix or edge case → add entry to `kb/DECISIONS_AND_LESSONS.md`
- Architecture change → update `kb/ARCHITECTURE.md`
- Financial model change → update `kb/FINANCIAL_MODEL.md`
- New dev/infra knowledge → update relevant memory file
- Always update `kb/ARCHITECTURE.md` "Last updated" date when modifying it
