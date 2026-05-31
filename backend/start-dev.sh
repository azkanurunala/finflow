#!/usr/bin/env bash
# Start the FinFlow backend stack for local development (self-healing):
#   1. Local MongoDB — (re)started if it isn't up.
#   2. FastAPI/uvicorn on 0.0.0.0:8001 — supervised: auto-restarts if it exits.
#
# Usage:  ./start-dev.sh        Stop: Ctrl-C (then ./stop-dev.sh to stop MongoDB).
cd "$(dirname "$0")"

MONGO_BIN=".mongodb/bin/mongod"
MONGO_DATA=".mongodb/data"
MONGO_LOG=".mongodb/mongod.log"

ensure_mongo() {
  if ! lsof -nP -iTCP:27017 -sTCP:LISTEN >/dev/null 2>&1; then
    echo "▶ Starting MongoDB (localhost:27017)…"
    "$MONGO_BIN" --dbpath "$MONGO_DATA" --port 27017 --bind_ip 127.0.0.1 --logpath "$MONGO_LOG" &
    for i in $(seq 1 30); do
      lsof -nP -iTCP:27017 -sTCP:LISTEN >/dev/null 2>&1 && break
      sleep 1
    done
    echo "  MongoDB up."
  fi
}

# Clean exit on Ctrl-C / TERM so the supervisor loop below doesn't restart.
STOP=0
trap 'STOP=1; echo; echo "▶ Stopping (Ctrl-C)…"; exit 0' INT TERM

echo "▶ FinFlow backend (self-healing). API: http://0.0.0.0:8001  LAN: http://$(ipconfig getifaddr en0 2>/dev/null || echo YOUR_LAN_IP):8001"

# Supervisor loop: keep Mongo + the API alive; restart the API if it crashes.
while [ "$STOP" -eq 0 ]; do
  ensure_mongo
  .venv/bin/uvicorn server:app --host 0.0.0.0 --port 8001 --reload
  code=$?
  [ "$STOP" -eq 1 ] && break
  echo "⚠ uvicorn exited (code $code). Restarting in 2s…  (Ctrl-C to stop)"
  sleep 2
done
