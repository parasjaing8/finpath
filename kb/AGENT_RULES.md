---
name: agent-rules
version: 1.1
applies_to: all_agents
priority: critical
updated: 2026-04-14
---
# Agent Rules — STRICT

These rules MUST be followed by all AI agents (Claude, DeepSeek, Qwen) when generating code,
responses, or instructions for the user.

---

## Section A — Environment Rules

### Rule 1: No Local File Access Instructions
NEVER tell the user to "open index.html", "double-click a file", "open in Finder", or use any
local file manager. The Mac Mini is HEADLESS — there is no display, no mouse, no keyboard.

### Rule 2: Always Provide the Play URL
ALWAYS tell the user the correct URL to access their project:
```
http://192.168.0.130:8080/play/<project-slug>/
```
This is the ONLY way to view web projects.

### Rule 3: Port 8080 is Reserved
NEVER use port 8080 for project-specific servers (Express, Flask, http-server, etc.). Port 8080
is the AI chat server. Do NOT start additional servers on any port — projects are auto-served
via the `/play/` route.

### Rule 4: Relative Asset Paths Only
Web projects MUST use relative paths for all assets:
- CORRECT: `src="js/game.js"`, `href="css/style.css"`
- WRONG: `src="/js/game.js"`, `href="/css/style.css"`
- WRONG: `src="C:/path/to/file"` or any absolute path

### Rule 5: No GUI Assumptions
NEVER assume a display, GUI, desktop environment, or local file access exists on the Mac.
No references to opening files in a browser locally, using Finder/Explorer, desktop
notifications, system tray icons, or GUI dialogs.

---

## Section B — Code Quality Rules

### Rule 6: Proper HTML Structure
When writing HTML projects, ALWAYS include:
```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Project Title</title>
</head>
```

### Rule 7: Complete, Runnable Code
Code must be COMPLETE and RUNNABLE. Never include:
- `// TODO: implement this`
- `// Add your code here`
- `/* placeholder */`
- Stub functions with no implementation
- References to external files that don't exist in the project

### Rule 8: Relative File Paths in Code
All file paths referenced in code (imports, src attributes, fetch URLs) must be relative. Never
use absolute filesystem paths.

### Rule 9: index.html Entry Point
Always create an `index.html` as the entry point for web projects. This is what gets served
when the user visits `/play/<slug>/`.

---

## Section C — Implementation Discipline

### Rule 10: Scope Discipline
Only implement what was explicitly asked. Do NOT:
- Add unrequested features or "nice to haves"
- Refactor code that wasn't part of the task
- Add error handling for scenarios that cannot happen
- Create extra files beyond what files_to_create specifies

### Rule 11: Verification Before Submission
Before outputting your final code, mentally verify:
- Every `<script src="X">` and `<link href="X">` references a file that actually exists
- Every `document.getElementById("X")` has a matching `id="X"` in the HTML
- Every function called via `onclick` or `addEventListener` is defined somewhere
- Every `import` statement is matched to a file with `type="module"` on the script tag

---

## Section D — Conditional Rules (apply only when relevant)

### Rule 12 [game/canvas projects]: Canvas Initialization
Canvas/game projects MUST:
- Obtain canvas context inside `DOMContentLoaded` via `document.getElementById()` — never assume
  `ctx` or `canvas` are global
- Start the game loop with `requestAnimationFrame` or `setInterval` inside `DOMContentLoaded`
- Include BOTH keyboard AND touch controls (use `@media (pointer: coarse)` for touch buttons)

### Rule 13 [multi-file projects]: Cross-file Consistency
When creating multiple files for the same project:
- Agree on shared function names and global variables UP FRONT — state them in a `/* PLAN: */`
  comment at the top of the first file output
- Every `window.myVar` or `window.myFn` used in one file MUST be defined in exactly one other file
- The HTML file MUST include ALL `<script>` and `<link>` tags for every file produced
