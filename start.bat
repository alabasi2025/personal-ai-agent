@echo off
chcp 65001 > nul
title 🧠 Personal AI Agent

echo.
echo ╔════════════════════════════════════════════════════════════╗
echo ║           🧠 Personal AI Agent - Starting...               ║
echo ╚════════════════════════════════════════════════════════════╝
echo.

:: Check if node_modules exists
if not exist "node_modules" (
    echo 📦 Installing dependencies...
    call pnpm install
)

:: Check if dist exists
if not exist "dist" (
    echo 🔨 Building project...
    call pnpm build
)

:: Create data directory
if not exist "data" mkdir data

:: Start the server
echo.
echo 🚀 Starting Personal AI Agent...
echo.
node dist/server/api.js

pause
