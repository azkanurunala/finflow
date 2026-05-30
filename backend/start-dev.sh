#!/usr/bin/env bash
# Start the FinFlow backend stack for local development:
#   1. Local MongoDB (downloaded binary, project-local data dir)
#   2. FastAPI backend via uvicorn on 0.0.0.0:8001 (LAN-reachable for the simulators/emulators)
#
# Usage:  ./start-dev.sh
# Stop:   Ctrl-C stops uvicorn; run ./stop-dev.sh to also stop MongoDB.
set -euo pipefail
cd "$(dirname "$0")"

MONGO_BIN=".mongodb/bin/mongod"
MONGO_DATA=".mongodb/data"
MONGO_LOG=".mongodb/mongod.log"

# 1. Start MongoDB only if it isn't already listening on 27017
if ! lsof -nP -iTCP:27017 -sTCP:LISTEN >/dev/null 2>&1; then
  echo "▶ Starting MongoDB (localhost:27017)…"
  "$MONGO_BIN" --dbpath "$MONGO_DATA" --port 27017 --bind_ip 127.0.0.1 --logpath "$MONGO_LOG" &
  # wait until it accepts connections
  for i in $(seq 1 30); do
    lsof -nP -iTCP:27017 -sTCP:LISTEN >/dev/null 2>&1 && break
    sleep 1
  done
  echo "  MongoDB up."
else
  echo "▶ MongoDB already running on 27017."
fi

# 2. Start the API (reads ./.env). --reload picks up code changes automatically.
echo "▶ Starting FastAPI on http://0.0.0.0:8001  (LAN: http://$(ipconfig getifaddr en0 2>/dev/null || echo 'YOUR_LAN_IP'):8001)"
exec .venv/bin/uvicorn server:app --host 0.0.0.0 --port 8001 --reload
