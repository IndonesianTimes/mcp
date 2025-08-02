@echo off
chcp 65001 > nul
setlocal enabledelayedexpansion

set "QUERY=%~1"

:: Generate JWT
for /f "delims=" %%i in ('node genToken.js') do set "TOKEN=%%i"

set "URL=http://localhost:3000/kb/query"
set "JSON={\"query\":\"%~1\"}"

echo 🖊️ JWT Token: !TOKEN!
echo 🔵 Sending query: !QUERY!
echo ------------------------------
echo 🧪 Executing:
echo curl -i -H "Authorization: !TOKEN!" -H "Content-Type: application/json" -X POST -d "!JSON!" "!URL!"
echo ------------------------------

curl -i -H "Authorization: !TOKEN!" -H "Content-Type: application/json" -X POST -d "!JSON!" "!URL!"

echo.
echo ✅ Query selesai: !QUERY
pause
