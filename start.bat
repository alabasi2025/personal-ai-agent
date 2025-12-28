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

:: Start MCP Server in background
echo.
echo 🖥️ Starting MCP Server on port 3000...
start "MCP Server" /min cmd /c "node mcp-server.js"

:: Wait for MCP Server to start
timeout /t 2 /nobreak > nul

:: Start the main server
echo.
echo 🚀 Starting Personal AI Agent on port 4000...
echo.
echo ═══════════════════════════════════════════════════════════════
echo   📍 Web Interface: http://localhost:4000
echo   📍 MCP Server:    http://localhost:3000
echo ═══════════════════════════════════════════════════════════════
echo.
node dist/server/api.js

pause
