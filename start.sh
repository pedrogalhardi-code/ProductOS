#!/bin/bash
# ProductOS — Local Dev Startup Script
# Run from the ProductOS directory: bash start.sh

set -e

echo ""
echo "🚀 ProductOS — Local Dev Startup"
echo "================================="
echo ""

# ─── Check Node version ───────────────────────────────────────────────────────
NODE_MAJOR=$(node -e "console.log(process.version.split('.')[0].slice(1))")
if [ "$NODE_MAJOR" -lt 18 ]; then
  echo "❌ Node.js 18+ required (you have $(node -v))"
  exit 1
fi
echo "✅ Node.js $(node -v)"

# ─── Install dependencies ─────────────────────────────────────────────────────
echo ""
echo "📦 Installing dependencies..."
npm install --workspaces

# ─── Set up .env if needed ────────────────────────────────────────────────────
if [ ! -f "server/.env" ]; then
  cp server/.env.example server/.env
  echo ""
  echo "📝 Created server/.env from .env.example"
  echo "   ⚠️  Add your ANTHROPIC_API_KEY to server/.env to enable AI generation"
fi

# ─── Database migration ───────────────────────────────────────────────────────
echo ""
echo "🗄️  Setting up database (SQLite)..."
cd server

# Make sure DATABASE_URL is set to SQLite if it's still postgresql default
if grep -q "postgresql://productos:productos@localhost" .env; then
  # Replace with SQLite for local dev
  sed -i.bak 's|DATABASE_URL="postgresql://productos:productos@localhost:5432/productos_dev"|DATABASE_URL="file:./dev.db"|g' .env
  echo "   Updated DATABASE_URL to SQLite (file:./dev.db)"
fi

# Generate Prisma client
npx prisma generate --schema prisma/schema.prisma

# Run migrations
npx prisma migrate dev --name init --schema prisma/schema.prisma 2>/dev/null || \
  npx prisma migrate deploy --schema prisma/schema.prisma 2>/dev/null || true

# Seed the database
npx tsx prisma/seed.ts 2>/dev/null || true

cd ..

# ─── Start dev servers ────────────────────────────────────────────────────────
echo ""
echo "🎯 Starting servers..."
echo "   API  → http://localhost:3001"
echo "   App  → http://localhost:5173"
echo "   Docs → http://localhost:3001/api/docs"
echo ""
echo "   Press Ctrl+C to stop"
echo ""

# Start both servers in parallel without relying on global concurrently
trap 'kill 0' SIGINT SIGTERM EXIT

npm run dev --workspace=server &
SERVER_PID=$!

npm run dev --workspace=client &
CLIENT_PID=$!

wait $SERVER_PID $CLIENT_PID
