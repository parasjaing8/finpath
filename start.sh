#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

if [[ ! -f ".venv/bin/activate" ]]; then
    echo "ERROR: virtual environment not found at $SCRIPT_DIR/.venv" >&2
    echo "Fix: python3 -m venv .venv && .venv/bin/pip install -r requirements.txt" >&2
    exit 1
fi

source .venv/bin/activate
mkdir -p logs

exec uvicorn server:app --host 0.0.0.0 --port 8080 --log-level info
