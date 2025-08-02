#!/usr/bin/env bash
set -e

PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
RELEASE_DIR="$PROJECT_ROOT/release"

# Clean previous release and temporary files
rm -rf "$RELEASE_DIR" mcp-server-release.zip
mkdir -p "$RELEASE_DIR"

# Remove node_modules directories and junk files
find "$PROJECT_ROOT" -name 'node_modules' -type d -prune -exec rm -rf {} +
find "$PROJECT_ROOT" -name '.DS_Store' -type f -delete
find "$PROJECT_ROOT" -name '*~' -type f -delete

# Copy project files to release directory
rsync -av --exclude='.git' --exclude='release' --exclude='node_modules' --exclude='*.zip' --exclude='logs' "$PROJECT_ROOT/" "$RELEASE_DIR/"

# Determine version
if [ -f "$PROJECT_ROOT/VERSION.txt" ]; then
  VERSION="$(cat "$PROJECT_ROOT/VERSION.txt")"
else
  VERSION="$(node -p "require('./package.json').version")"
fi

echo "$VERSION" > "$RELEASE_DIR/VERSION.txt"

git log -n 10 --pretty=format:"%h %s" > "$RELEASE_DIR/CHANGELOG.txt"

# Create zip archive
cd "$PROJECT_ROOT"
zip -r mcp-server-release.zip release >/dev/null

echo "Release package created: mcp-server-release.zip"

