"""Skills system — keyword-based skill injection into worker prompts."""
from __future__ import annotations
import hashlib
import re
from pathlib import Path

SKILLS_DIR = Path(__file__).parent / "skills"

# Maximum number of skills injected per call (avoids bloating prompts)
_MAX_SKILLS = 3


def _parse_frontmatter(raw: str) -> tuple[dict, str]:
    """Parse YAML-style frontmatter (---...---) and return (meta, body).

    Reads only simple ``key: value`` pairs (no nested YAML).
    Returns an empty dict and the full text if no frontmatter is found.
    """
    m = re.match(r"^---\s*\n(.*?)\n---\s*\n?(.*)", raw, re.DOTALL)
    if not m:
        return {}, raw
    meta_block, body = m.group(1), m.group(2)
    meta: dict = {}
    for line in meta_block.splitlines():
        kv = re.match(r"^(\w[\w-]*):\s*(.+)$", line.strip())
        if kv:
            meta[kv.group(1)] = kv.group(2).strip()
    return meta, body.strip()


def load_skills(context: str) -> str:
    """Load skill content whose keywords match the given context string.

    Each skill file (skills/*.md) must have frontmatter with a 'keywords' line:
        keywords: ssh, remote, terminal, shell
    An optional ``priority`` field (integer, lower = higher priority) controls
    injection order when multiple skills match. Default priority is 50.
    Only ``_MAX_SKILLS`` unique skill bodies are injected per call.
    """
    if not SKILLS_DIR.exists():
        return ""

    ctx_lower = context.lower()
    candidates: list[tuple[int, str]] = []  # (priority, body)
    seen_hashes: set[str] = set()

    for skill_file in sorted(SKILLS_DIR.glob("*.md")):
        try:
            raw = skill_file.read_text(encoding="utf-8")
            meta, body = _parse_frontmatter(raw)

            kw_raw = meta.get("keywords", "")
            if not kw_raw:
                # Fall back to bare ``keywords:`` line outside frontmatter
                kw_match = re.search(r"^keywords:\s*(.+)$", raw, re.MULTILINE)
                if not kw_match:
                    continue
                kw_raw = kw_match.group(1)

            keywords = [k.strip() for k in kw_raw.split(",") if k.strip()]
            if not any(re.search(r'\b' + re.escape(kw) + r'\b', ctx_lower) for kw in keywords):
                continue

            if not body:
                continue

            # Deduplicate by content hash
            h = hashlib.md5(body.encode()).hexdigest()
            if h in seen_hashes:
                continue
            seen_hashes.add(h)

            priority = int(meta.get("priority", 50))
            candidates.append((priority, body))
        except Exception:
            pass

    if not candidates:
        return ""

    # Sort by priority (ascending = highest priority first), cap at _MAX_SKILLS
    candidates.sort(key=lambda x: x[0])
    injected = [body for _, body in candidates[:_MAX_SKILLS]]
    return "\n\n---\nACTIVE SKILLS:\n" + "\n\n".join(injected)
