#!/usr/bin/env bash
# Stop the local FinFlow backend stack (uvicorn + local MongoDB).
cd "$(dirname "$0")"

echo "▶ Stopping uvicorn (port 8001)…"
lsof -ti tcp:8001 2>/dev/null | xargs kill 2>/dev/null && echo "  stopped." || echo "  not running."

echo "▶ Stopping MongoDB (port 27017)…"
# Graceful shutdown of the project-local mongod
.mongodb/bin/mongod --dbpath .mongodb/data --shutdown 2>/dev/null \
  && echo "  stopped." \
  || { lsof -ti tcp:27017 2>/dev/null | xargs kill 2>/dev/null && echo "  stopped (signal)."; } \
  || echo "  not running."
