#!/usr/bin/env bash
set -Eeuo pipefail

# ====== OTOMATIS DETEK FOLDER PROYEK (tempat file ini berada) ======
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
MCP_DIR="$SCRIPT_DIR"

# File KB yang dipantau (di folder MCP). GANTI kalau lokasinya berbeda.
WATCH_PATH="$MCP_DIR/knowledgebase_meili.json"

# Deteksi lokasi node (fallback /usr/bin/node)
NODE_BIN="$(command -v node || echo /usr/bin/node)"

# Debounce agar tidak double-trigger saat file diganti cepat (ms)
DEBOUNCE_MS=800

# ====== CEK PRASYARAT ======
if ! command -v inotifywait >/dev/null 2>&1; then
  echo "[WATCHER] inotifywait tidak ditemukan. Install: apt-get install -y inotify-tools" >&2
  exit 1
fi
if [[ ! -e "$WATCH_PATH" ]]; then
  echo "[WATCHER] Warning: target belum ada: $WATCH_PATH (menunggu event create…)"
fi

# ====== FUNGSI KERJA ======
last_run=0
run_jobs() {
  echo "[WATCHER] $(date '+%F %T') perubahan terdeteksi ? dedupe & push…"
  cd "$MCP_DIR"

  if ! "$NODE_BIN" "$MCP_DIR/dedupe_kb.js"; then
    echo "[WATCHER] dedupe_kb.js GAGAL" >&2
  else
    echo "[WATCHER] dedupe_kb.js OK"
  fi

  if ! "$NODE_BIN" "$MCP_DIR/push_and_check.js"; then
    echo "[WATCHER] push_and_check.js GAGAL" >&2
  else
    echo "[WATCHER] push_and_check.js OK"
  fi
}

# ====== LOOP PANTAU ======
echo "[WATCHER] start | MCP_DIR=$MCP_DIR | WATCH_PATH=$WATCH_PATH"
# close_write + move + create untuk menangkap overwrite file
while inotifywait -e close_write,move,create "$WATCH_PATH" 2>/dev/null; do
  now_ms=$(date +%s%3N 2>/dev/null || echo "$(date +%s)000")
  if (( now_ms - last_run < DEBOUNCE_MS )); then
    echo "[WATCHER] debounce…"
    continue
  fi
  last_run=$now_ms
  run_jobs
done
