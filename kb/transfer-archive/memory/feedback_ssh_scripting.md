---
name: SSH Scripting — Template Literals and Shell Quoting
description: How to safely write Python scripts with backticks/template literals via SSH on Mac mini
type: feedback
originSessionId: 3ad0574f-f1b9-4617-8372-bae221188f58
---
Template literal strings (backtick + `${}`) cannot be safely written in Python one-liners via SSH due to shell quoting conflicts.

**Why:** Backticks are interpreted by zsh as command substitution. Single quotes inside heredocs conflict with the heredoc delimiter. This causes silent failures where the file is written but string content is corrupted (quotes stripped, variables expanded incorrectly).

**How to apply:** Always write Python fix scripts to a temp file first, then execute:

```bash
# Write script to file
ssh parasjain@192.168.0.130 'cat > /tmp/fix_name.py << '"'"'PYEOF'"'"'
# Python code here — safe to use any quotes, backticks, ${} freely
with open("/path/to/file") as f:
    content = f.read()
content = content.replace("old", "new with `backticks` and ${vars}")
open("/path/to/file", "w").write(content)
PYEOF
python3 /tmp/fix_name.py'
```

Never use Python one-liners (`python3 -c "..."`) for scripts that contain template literals, backticks, or mixed quote types.
