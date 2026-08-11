#!/usr/bin/env bash
# Render Build Script
set -o errexit

echo "📦 Installing dependencies..."
npm install

echo "🔨 Building frontend..."
npm run build

echo "✅ Build complete!"
ls -la dist/ 2>/dev/null || echo "⚠️ dist/ directory not found after build!"
