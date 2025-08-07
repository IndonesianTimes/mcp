@echo off
chcp 65001 > nul
setlocal enabledelayedexpansion

:: Gunakan argumen pertama sebagai pertanyaan
set "QUESTION=%~1"

:: Generate JWT pakai Node.js (genToken.js harus valid di project)
for /f "delims=" %%i in ('node genToken.js') do set "TOKEN=%%i"

:: Endpoint dan JSON
set "URL=http://127.0.0.1:3000/ask"
set "JSON={\"question\":\"%QUESTION%\"}"

echo.
echo 🖊️ JWT Token: !TOKEN!
echo 🔵 Sending question: !QUESTION!
echo ------------------------------
echo 🧪 Executing:
echo curl -i -H "Authorization: !TOKEN!" -H "Content-Type: application/json" -X POST -d "!JSON!" "!URL!"
echo ------------------------------

REM Kirim request POST ke /ask dan simpan response ke file sementara
curl -s -H "Authorization: Bearer !TOKEN!" -H "Content-Type: application/json" -X POST -d "!JSON!" "!URL!" > response.json

echo.
echo ===== RESPONSE JSON =====
type response.json
echo =========================

REM Extract bagian "sources" dari response.json untuk logging lebih jelas (jika ada jq)
REM Jika jq tersedia, uncomment baris berikut dan pastikan jq sudah terinstall di Windows
REM jq ".data.sources" response.json

echo.
echo ✅ Query selesai: !QUESTION!
pause
