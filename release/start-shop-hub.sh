#!/usr/bin/env bash
# ============================================================================
# Karaoke & PS5 Commerce Hub - Production Standalone Launcher (Linux/Mac)
# ============================================================================

set -e

export NODE_ENV=production
export PORT="${PORT:-3000}"
export APP_DATA_DIR="${APP_DATA_DIR:-$(pwd)/data}"

echo "================================================================"
echo "          Karaoke & PS5 Commerce Hub - Standalone Host"
echo "          100% Offline Local Shop Server & Real-Time Hub"
echo "================================================================"
echo "Data Directory: $APP_DATA_DIR"
echo "Local Port:     $PORT"
echo ""

if [ ! -f "dist/index.html" ] || [ ! -f "dist/server.cjs" ]; then
    echo "[INFO] Building production bundle..."
    npm run build
fi

echo "[STATUS] Starting production server on port $PORT..."
exec node dist/server.cjs
