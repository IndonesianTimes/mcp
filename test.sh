#!/usr/bin/env bash
set -e
QUERY="$1"
TOKEN=$(node genToken.js)
ENCODED_QUERY=$(node -e "console.log(encodeURIComponent(process.argv[1]))" "$QUERY")
URL="http://localhost:3000/kb/search?query=$ENCODED_QUERY"

echo "🖊️ JWT Token: $TOKEN"
echo "🔵 Sending query: $QUERY"
echo "------------------------------"
echo "🧪 Executing:"
echo "curl -i -H \"Authorization: $TOKEN\" \"$URL\""
echo "------------------------------"

curl -i -H "Authorization: $TOKEN" "$URL"
echo

echo "✅ Query selesai: $QUERY"
