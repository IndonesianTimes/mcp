@echo off
chcp 65001 > nul
setlocal enabledelayedexpansion

set "QUERY=%~1"

:: Generate JWT
for /f "delims=" %%i in ('node genToken.js') do set "TOKEN=%%i"

:: Encode spasi jadi %20
set "ENCODED_QUERY=!QUERY: =%%20!"
set "URL=http://localhost:3000/kb/search?query=!ENCODED_QUERY!"

echo 🖊️ JWT Token: !TOKEN!
echo 🔵 Sending query: !QUERY!
echo ------------------------------
echo 🧪 Executing:
echo curl -i -H "Authorization: Bearer !TOKEN!" "!URL!"
echo ------------------------------

curl -i -H "Authorization: Bearer !TOKEN!" "!URL!"

echo.
echo ✅ Query selesai: !QUERY!
pause
