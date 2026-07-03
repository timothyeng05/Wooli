#!/bin/bash
set -euo pipefail

# Session setup for Claude Code on the web. Local machines manage their own
# environment — this hook only runs in remote sessions.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR"

# Fresh containers start without node_modules; npm install is fast when the
# container cache already has it, and picks up lockfile changes when it doesn't.
npm install --no-audit --no-fund

# Placeholder Supabase env so `npm run dev` boots for preview/screenshot work.
# Remote sessions have no real secrets. Never overwrite an existing file.
if [ ! -f .env.local ]; then
  cat > .env.local <<'ENV'
# Placeholder env written by .claude/hooks/session-start.sh (remote sessions only).
# The dev server boots with these; anything touching real Supabase data will not work.
NEXT_PUBLIC_SUPABASE_URL=https://placeholder.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder.placeholder
ENV
fi

echo "session-start: dependencies installed, env ready"
