#!/usr/bin/env bash
# Builds the Chrome Web Store package: the extension files only (no tests, no store folder).
set -euo pipefail
cd "$(dirname "$0")/.."
v=$(python3 -c 'import json;print(json.load(open("manifest.json"))["version"])')
out="store/verse-opener-$v.zip"
rm -f "$out"
zip -q -X -r "$out" manifest.json *.js *.html *.css icons
echo "$out"; unzip -l "$out" | tail -1
