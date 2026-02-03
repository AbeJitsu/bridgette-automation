#!/bin/bash
set -e

LABEL="com.bridgette.server"
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_DIR="$PROJECT_ROOT/app"
PORT=3000

case "${1:-help}" in
  stop)
    echo "[dev-control] Stopping launchd service: $LABEL"
    launchctl stop "$LABEL" 2>/dev/null || echo "[dev-control] Service not loaded"
    echo "[dev-control] Killing any processes on port $PORT"
    lsof -ti:$PORT | xargs kill -9 2>/dev/null || true
    sleep 1
    ;;

  start)
    echo "[dev-control] Starting launchd service: $LABEL"
    launchctl start "$LABEL"
    sleep 3
    echo "[dev-control] Service started. Check with: curl http://localhost:3000/api/health"
    ;;

  dev)
    echo "[dev-control] Starting dev server manually (one-time, not persistent)"
    cd "$APP_DIR"
    echo "[dev-control] Killing any processes on port $PORT"
    lsof -ti:$PORT | xargs kill -9 2>/dev/null || true
    sleep 2
    npm run dev
    ;;

  status)
    echo "[dev-control] Checking service status..."
    launchctl list | grep -i "$LABEL" || echo "[dev-control] Service not loaded"
    echo ""
    lsof -i:$PORT || echo "[dev-control] Port $PORT is free"
    ;;

  *)
    cat << 'EOF'
Usage: ./scripts/dev-control.sh <command>

Commands:
  stop    - Stop launchd service and kill any processes on port 3000
  start   - Start launchd service (after development is done)
  dev     - Start dev server manually (one-time, for testing)
  status  - Check if service is loaded and port is in use
  help    - Show this message

Examples:
  ./scripts/dev-control.sh stop      # Prepare for development testing
  ./scripts/dev-control.sh dev       # Run dev server for testing
  ./scripts/dev-control.sh start     # Restore production behavior
EOF
    ;;
esac
