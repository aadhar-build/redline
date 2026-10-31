#!/bin/bash
# Run one OCR configuration and score it.
#   variants.sh <name> <base-url> <browser> <scale> [query]
# Writes <OUT_DIR>/<name>.json and <OUT_DIR>/score-<name>.json, prints the overall line.
set -e
cd "$(dirname "$0")"
: "${OUT_DIR:?}" "${TRUTH_DIR:?}" "${PLAN:?}"
name="$1"; base="$2"; browser="$3"; scale="$4"; query="${5:-}"
node run.mjs ocr "$base" "$browser" "$PLAN" "$OUT_DIR/$name.json" "$scale" "$query"
node score.mjs "$TRUTH_DIR" "$OUT_DIR/$name.json" > "$OUT_DIR/score-$name.json"
node -e "const s=require(process.argv[1]); console.log(process.argv[2], JSON.stringify(s.overall))" "$OUT_DIR/score-$name.json" "$name"
