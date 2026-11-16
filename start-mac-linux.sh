#!/usr/bin/env bash
cd "$(dirname "$0")"
[ -d .venv ] || python3 -m venv .venv
source .venv/bin/activate
pip install -q -r requirements.txt
[ -d node_modules ] || npm install
echo ""
echo "  Cicero Online is starting... open http://localhost:3000"
echo ""
npm run dev
