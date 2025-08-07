@echo off
REM ==== AMBIL KONFIG DARI .env ====
setlocal enabledelayedexpansion

REM Default value
set MEILI_API_KEY=masterKey
set MEILI_PORT=7700
set DOCKER_CONTAINER=meili_mcp
set MEILI_IMAGE=getmeili/meilisearch:v1.8

REM Baca MEILI_API_KEY dan HOST
for /f "usebackq tokens=1,2 delims==" %%a in (".env") do (
  if /I "%%a"=="MEILI_API_KEY" set MEILI_API_KEY=%%b
  if /I "%%a"=="MEILI_HOST" set TMP=%%b
)
REM Ambil PORT dari MEILI_HOST (http://localhost:7700)
for /f "tokens=3 delims=:" %%a in ("!TMP!") do set MEILI_PORT=%%a

echo =====================================
echo MEILI_API_KEY: %MEILI_API_KEY%
echo MEILI_PORT: %MEILI_PORT%
echo DOCKER_CONTAINER: %DOCKER_CONTAINER%
echo MEILI_IMAGE: %MEILI_IMAGE%
echo =====================================

REM ==== REMOVE CONTAINER JIKA ADA ====
docker stop %DOCKER_CONTAINER% >nul 2>&1
docker rm %DOCKER_CONTAINER% >nul 2>&1

REM ==== RUN CONTAINER BARU ====
docker run -d --name %DOCKER_CONTAINER% -p %MEILI_PORT%:7700 -e MEILI_MASTER_KEY=%MEILI_API_KEY% %MEILI_IMAGE%

REM Tunggu Meili siap
timeout /T 6

REM ==== KILL node.js ====
taskkill /F /IM node.exe

REM Tunggu sebentar
timeout /T 2

REM ==== START NODE.JS ====
REM Jika pakai npm start:
start cmd /k "cd /d %~dp0 && npm start"
REM Jika mau langsung node server.js:
REM start cmd /k "cd /d %~dp0 && node server.js"

echo === MeiliSearch Docker & MCP Server SUDAH DIRESTART ===
pause
