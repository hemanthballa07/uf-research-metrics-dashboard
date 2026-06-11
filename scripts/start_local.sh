#!/bin/bash

# Startup script for UF Research Metrics Dashboard
# This script uses a local isolated pnpm installation to avoid system dependency issues.

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PNPM_BIN="$PROJECT_ROOT/bin/node_modules/.bin/pnpm"

# Ensure isolated pnpm is installed
if [ ! -f "$PNPM_BIN" ]; then
    echo "📦 Setting up local pnpm..."
    mkdir -p "$PROJECT_ROOT/bin"
    cd "$PROJECT_ROOT/bin"
    npm init -y > /dev/null 2>&1
    npm install pnpm > /dev/null 2>&1
    cd "$PROJECT_ROOT"
fi

echo "🚀 Starting UF Research Metrics Dashboard..."
echo "Backend: http://localhost:3001"
echo "Frontend: http://localhost:3000"

# Execute pnpm dev
exec "$PNPM_BIN" dev
