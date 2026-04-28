---
name: Audit Protocol — Code Over Docs
description: When auditing or analysing, always read actual source code first. Docs are context, not truth.
type: feedback
originSessionId: 41d26405-a6d0-43b0-a549-9d8f1fa116a8
---
When asked to audit, review, or analyse the codebase:

1. **Read actual source files first** — `ssh parasjain@192.168.0.130 'cat ~/finpath/path/to/file'`
2. **Then** read kb/ docs as supplementary context
3. **If docs and code disagree, code is truth** — update the stale doc immediately
4. **Flag any drift** you find between docs and code

**Why:** On 2026-04-11 an audit trusted stale kb/ docs and gave wrong recommendations (e.g., said to remove a Pro gate that had already been removed in commit eb1fdcb). Docs had not been updated after code changes in sessions r7-r13.

**How to apply:** Before making any claim about the codebase in an audit or analysis, verify the claim by reading the actual file. Never cite a doc as proof of what the code does.
