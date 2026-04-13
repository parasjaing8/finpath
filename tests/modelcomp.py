"""
Model Comparison — single coding task, 4 models, Claude-as-judge scoring.

Models tested (sequentially):
  1. Claude (claude-sonnet-4-6)
  2. Qwen Coder 7B  (qwen2.5-coder:7b)
  3. Qwen 9B        (qwen3.5:9b)
  4. DeepSeek 16B   (deepseek-coder-v2:16b-lite-instruct-q5_K_S)

Scoring (100 pts total) by Claude judge:
  - Instruction following  40 pts  (each explicit requirement = points)
  - Code correctness       25 pts  (no syntax errors, logic works)
  - Code quality           20 pts  (clean, no TODOs, no placeholders)
  - Mobile / UX            15 pts  (responsive, looks good)

Usage (on Mac Mini with venv Python):
  .venv/bin/python modelcomp.py
"""

import asyncio
import json
import os
import re
import time
from datetime import datetime
from pathlib import Path
import httpx

# Load .env from same directory as this script
_env_path = Path(__file__).parent / ".env"
if _env_path.exists():
    for _line in _env_path.read_text().splitlines():
        _line = _line.strip()
        if _line and not _line.startswith("#") and "=" in _line:
            _k, _, _v = _line.partition("=")
            os.environ.setdefault(_k.strip(), _v.strip())

OLLAMA_BASE   = "http://localhost:11434"
ANTHROPIC_KEY = os.getenv("ANTHROPIC_API_KEY", "")

# ── The coding problem ────────────────────────────────────────────────────────
PROBLEM_TITLE = "2-Player Tic-Tac-Toe Web App"

PROBLEM = """\
Build a complete, single self-contained index.html file for a 2-player Tic-Tac-Toe game.

REQUIREMENTS (must implement ALL of these):
1. 3×3 clickable grid
2. Players alternate turns — X always goes first
3. After each move, check for win or draw
4. Winning row/column/diagonal cells must be highlighted in a distinct colour
5. Display whose turn it is (e.g. "Player X's turn")
6. Show a result message when game ends: "X wins!", "O wins!", or "It's a draw!"
7. A "New Game" button that resets the board (does NOT reset scores)
8. A score tracker that persists across games: shows X wins, O wins, Draws
9. Dark background with neon/accent colours (no plain white background)
10. No external dependencies — zero CDN links, zero <script src>, zero <link href> to external URLs

OUTPUT: A single index.html file. Nothing else. No explanation before or after the code block.
"""

JUDGE_SYSTEM = """\
You are a strict code evaluator. You receive a coding task spec and a model's output.
Score the output out of 100 using this exact rubric:

INSTRUCTION FOLLOWING — 40 pts (5 pts each requirement):
  R1  3×3 clickable grid present and functional
  R2  Players alternate X / O, X starts first
  R3  Win/draw detection after each move
  R4  Winning cells highlighted in a distinct colour
  R5  "whose turn" indicator displayed
  R6  Result message shown (win or draw)
  R7  "New Game" button resets board only, not scores
  R8  Score tracker (X wins, O wins, Draws) persists across games
  R9  Dark background with neon/accent colours
  R10 Zero external dependencies (no CDN, no external src/href)

CODE CORRECTNESS — 25 pts:
  C1  No syntax errors (valid HTML/JS/CSS)  (10 pts)
  C2  Game logic is correct — win detection covers all 8 lines (8 pts)
  C3  Score updates correctly on win AND draw (7 pts)

CODE QUALITY — 20 pts:
  Q1  No TODOs, no placeholders, no "add logic here" comments  (10 pts)
  Q2  Code is clean, readable, uses sensible variable names     (10 pts)

MOBILE / UX — 15 pts:
  M1  Has <meta name="viewport"> tag                  (5 pts)
  M2  Grid is touch-friendly (cells large enough)     (5 pts)
  M3  Layout looks good, not broken or ugly           (5 pts)

Respond with ONLY valid JSON, no markdown:
{
  "scores": {
    "R1":5,"R2":5,"R3":5,"R4":5,"R5":5,"R6":5,"R7":5,"R8":5,"R9":5,"R10":5,
    "C1":10,"C2":8,"C3":7,
    "Q1":10,"Q2":10,
    "M1":5,"M2":5,"M3":5
  },
  "total": 100,
  "summary": "2-sentence verdict",
  "notable_bugs": ["list any real bugs or missing requirements"],
  "highlights": ["list 1-2 things done well"]
}
"""

MODELS = [
    {
        "id":    "claude",
        "label": "Claude Sonnet 4.6",
        "type":  "claude",
        "model": "claude-sonnet-4-6",
    },
    {
        "id":    "qwen-coder-7b",
        "label": "Qwen Coder 7B",
        "type":  "ollama",
        "model": "qwen2.5-coder:7b",
    },
    {
        "id":    "qwen-9b",
        "label": "Qwen 9B",
        "type":  "ollama",
        "model": "qwen3.5:9b",
    },
    {
        "id":    "deepseek-16b",
        "label": "DeepSeek Coder 16B",
        "type":  "ollama",
        "model": "deepseek-coder-v2:16b-lite-instruct-q5_K_S",
    },
]

WIDE = "═" * 72
SEP  = "─" * 72


# ── Model callers ─────────────────────────────────────────────────────────────

async def call_claude(prompt: str) -> tuple[str, float, int]:
    """Returns (output, elapsed_seconds, output_chars)"""
    t0 = time.time()
    full = ""
    async with httpx.AsyncClient(timeout=300) as client:
        async with client.stream(
            "POST",
            "https://api.anthropic.com/v1/messages",
            headers={
                "x-api-key":         ANTHROPIC_KEY,
                "anthropic-version": "2023-06-01",
                "content-type":      "application/json",
            },
            json={
                "model":      "claude-sonnet-4-6",
                "max_tokens": 4096,
                "stream":     True,
                "messages":   [{"role": "user", "content": prompt}],
            },
        ) as resp:
            async for line in resp.aiter_lines():
                if not line.startswith("data: "):
                    continue
                raw = line[6:]
                try:
                    ev = json.loads(raw)
                    if ev.get("type") == "content_block_delta":
                        chunk = ev.get("delta", {}).get("text", "")
                        if chunk:
                            full += chunk
                            print(".", end="", flush=True)
                except Exception:
                    pass
    return full, time.time() - t0, len(full)


async def call_ollama(model: str, prompt: str) -> tuple[str, float, int]:
    """Returns (output, elapsed_seconds, output_chars)"""
    t0   = time.time()
    full = ""

    # Strip <think>...</think> blocks (qwen3.5:9b outputs these)
    in_think = False
    pending  = ""

    async with httpx.AsyncClient(timeout=300) as client:
        async with client.stream(
            "POST",
            f"{OLLAMA_BASE}/api/chat",
            json={
                "model":   model,
                "stream":  True,
                "messages": [
                    {"role": "system", "content": "You are an expert web developer. Output only the requested code."},
                    {"role": "user",   "content": "/no_think\n" + prompt},
                ],
                "options": {"num_ctx": 16384, "num_predict": 4096},
            },
        ) as resp:
            async for line in resp.aiter_lines():
                if not line:
                    continue
                try:
                    ev    = json.loads(line)
                    chunk = ev.get("message", {}).get("content", "")
                    if not chunk:
                        continue

                    # Strip <think> blocks
                    pending += chunk
                    while True:
                        if in_think:
                            end = pending.find("</think>")
                            if end == -1:
                                pending = ""
                                break
                            pending  = pending[end + 8:]
                            in_think = False
                        else:
                            start = pending.find("<think>")
                            if start == -1:
                                full += pending
                                print(".", end="", flush=True)
                                pending = ""
                                break
                            full    += pending[:start]
                            pending  = pending[start + 7:]
                            in_think = True
                except Exception:
                    pass

    full += pending  # flush
    return full, time.time() - t0, len(full)


async def judge_output(model_label: str, output: str) -> dict:
    """Ask Claude to score the output. Returns the score dict."""
    prompt = (
        f"TASK SPEC:\n{PROBLEM}\n\n"
        f"MODEL OUTPUT (from {model_label}):\n{output[:8000]}"
    )
    async with httpx.AsyncClient(timeout=60) as client:
        r = await client.post(
            "https://api.anthropic.com/v1/messages",
            headers={
                "x-api-key":         ANTHROPIC_KEY,
                "anthropic-version": "2023-06-01",
                "content-type":      "application/json",
            },
            json={
                "model":      "claude-sonnet-4-6",
                "max_tokens": 1024,
                "system":     JUDGE_SYSTEM,
                "messages":   [{"role": "user", "content": prompt}],
            },
        )
    if r.status_code != 200:
        return {"total": 0, "summary": f"Judge error {r.status_code}", "scores": {}}
    resp = r.json()
    text = resp["content"][0]["text"]
    # strip markdown fences
    text = re.sub(r'^```(?:json)?\s*', '', text.strip())
    text = re.sub(r'\s*```$', '', text.strip())
    try:
        return json.loads(text)
    except Exception:
        return {"total": 0, "summary": f"Parse error: {text[:100]}", "scores": {}}


def extract_html(output: str) -> str:
    """Pull the HTML block out of model output."""
    # Try fenced code block first
    m = re.search(r'```(?:html)?\s*\n([\s\S]*?)```', output, re.IGNORECASE)
    if m:
        return m.group(1).strip()
    # Fallback: look for <!DOCTYPE
    m = re.search(r'(<!DOCTYPE[\s\S]*)', output, re.IGNORECASE)
    if m:
        return m.group(1).strip()
    return output.strip()


# ── Main ─────────────────────────────────────────────────────────────────────

async def main():
    print(f"\n{WIDE}")
    print(f"  MODEL COMPARISON — {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"  Task: {PROBLEM_TITLE}")
    print(f"  Models: {len(MODELS)} (sequential)")
    print(f"{WIDE}\n")

    results = []

    for m in MODELS:
        print(f"\n{SEP}")
        print(f"  [{m['label']}]  generating...")
        print(f"  ", end="", flush=True)

        try:
            if m["type"] == "claude":
                if not ANTHROPIC_KEY:
                    print("\n  SKIP — no ANTHROPIC_API_KEY")
                    results.append({**m, "output": "", "elapsed": 0, "chars": 0,
                                    "score": {"total": 0, "summary": "Skipped — no API key", "scores": {}}})
                    continue
                output, elapsed, chars = await call_claude(PROBLEM)
            else:
                output, elapsed, chars = await call_ollama(m["model"], PROBLEM)

            print(f"\n  Done: {elapsed:.1f}s  {chars} chars  ({chars/elapsed:.0f} c/s)")

        except Exception as e:
            print(f"\n  ERROR: {e}")
            results.append({**m, "output": "", "elapsed": 0, "chars": 0,
                             "score": {"total": 0, "summary": f"Error: {e}", "scores": {}}})
            continue

        html = extract_html(output)
        print(f"  HTML extracted: {len(html)} chars")

        # Save output file
        out_path = f"/tmp/modelcomp_{m['id']}.html"
        with open(out_path, "w") as f:
            f.write(html)
        print(f"  Saved: {out_path}")

        # Judge
        print(f"  Judging...", end="", flush=True)
        score = await judge_output(m["label"], output)
        print(f" {score.get('total', '?')}/100")

        results.append({
            **m,
            "output":  output,
            "html":    html,
            "elapsed": elapsed,
            "chars":   chars,
            "cps":     chars / elapsed if elapsed > 0 else 0,
            "score":   score,
        })

    # ── Report ────────────────────────────────────────────────────────────────
    print(f"\n\n{WIDE}")
    print(f"  RESULTS — {PROBLEM_TITLE}")
    print(f"{WIDE}\n")

    # Sort by total score desc
    ranked = sorted(results, key=lambda r: r["score"].get("total", 0), reverse=True)

    # Header
    print(f"  {'Rank':<5} {'Model':<22} {'Score':>7} {'Time':>8} {'Speed':>9}  {'Verdict'}")
    print(f"  {SEP}")
    for i, r in enumerate(ranked, 1):
        total   = r["score"].get("total", 0)
        elapsed = r.get("elapsed", 0)
        cps     = r.get("cps", 0)
        summary = r["score"].get("summary", "—")[:50]
        medal   = ["🥇", "🥈", "🥉", "  "][min(i-1, 3)]
        print(f"  {medal} #{i}  {r['label']:<22} {total:>5}/100  {elapsed:>6.1f}s  {cps:>7.0f}c/s  {summary}")

    # Detailed breakdown per model
    RUBRIC_GROUPS = [
        ("Instruction Following (40pts)",
         ["R1","R2","R3","R4","R5","R6","R7","R8","R9","R10"],
         [5,5,5,5,5,5,5,5,5,5]),
        ("Code Correctness (25pts)",
         ["C1","C2","C3"],
         [10,8,7]),
        ("Code Quality (20pts)",
         ["Q1","Q2"],
         [10,10]),
        ("Mobile / UX (15pts)",
         ["M1","M2","M3"],
         [5,5,5]),
    ]

    LABELS = {
        "R1":"3×3 grid","R2":"X/O alternation","R3":"Win/draw detect",
        "R4":"Winning highlight","R5":"Turn indicator","R6":"Result message",
        "R7":"New Game resets board","R8":"Score persists","R9":"Dark/neon style",
        "R10":"No external deps",
        "C1":"No syntax errors","C2":"Win logic all 8 lines","C3":"Score updates",
        "Q1":"No TODOs","Q2":"Clean code",
        "M1":"Viewport meta","M2":"Touch-friendly","M3":"Good layout",
    }

    print(f"\n{WIDE}")
    print(f"  DETAILED SCORECARD")
    print(f"{WIDE}")

    # Column headers
    model_names = [r["label"][:16] for r in results]
    hdr = f"  {'Criterion':<28} {'Max':>4}  " + "  ".join(f"{n:>16}" for n in model_names)
    print(hdr)
    print(f"  {SEP}")

    for group_title, keys, maxes in RUBRIC_GROUPS:
        print(f"\n  {group_title}")
        for key, mx in zip(keys, maxes):
            label = LABELS.get(key, key)
            vals  = []
            for r in results:
                v = r["score"].get("scores", {}).get(key, "—")
                vals.append(v)
            val_str = "  ".join(
                f"{str(v):>16}" if not isinstance(v, int) else
                (f"\033[92m{v:>16}\033[0m" if v == mx else
                 f"\033[91m{v:>16}\033[0m" if v == 0 else
                 f"\033[93m{v:>16}\033[0m")
                for v in vals
            )
            print(f"  {key:<4} {label:<24} {mx:>4}  {val_str}")

    # Totals
    print(f"\n  {SEP}")
    totals = "  ".join(
        f"\033[1m{r['score'].get('total',0):>16}\033[0m" for r in results
    )
    print(f"  {'TOTAL':<28} {'100':>4}  {totals}")

    # Bugs / highlights
    print(f"\n{WIDE}")
    print(f"  NOTABLE BUGS & HIGHLIGHTS")
    print(f"{WIDE}")
    for r in ranked:
        print(f"\n  {r['label']}")
        bugs = r["score"].get("notable_bugs", [])
        hi   = r["score"].get("highlights", [])
        for b in bugs[:3]:
            print(f"    ✗ {b}")
        for h in hi[:2]:
            print(f"    ✓ {h}")

    # Time comparison
    print(f"\n{WIDE}")
    print(f"  SPEED COMPARISON")
    print(f"{WIDE}")
    by_speed = sorted([r for r in results if r.get("elapsed",0) > 0],
                      key=lambda r: r["elapsed"])
    for r in by_speed:
        bar_len = min(40, int(r["elapsed"] / 3))
        bar     = "█" * bar_len
        print(f"  {r['label']:<22} {r['elapsed']:>6.1f}s  {bar}  {r.get('cps',0):.0f} c/s")

    # Output files
    print(f"\n{WIDE}")
    print(f"  OUTPUT FILES (open in browser to test)")
    print(f"{WIDE}")
    for r in results:
        if r.get("html"):
            print(f"  /tmp/modelcomp_{r['id']}.html  ({len(r.get('html',''))} chars)")

    print(f"\n{WIDE}\n")


if __name__ == "__main__":
    asyncio.run(main())
