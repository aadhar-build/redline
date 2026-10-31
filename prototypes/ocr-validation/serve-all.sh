#!/bin/bash
# Start the three harness configurations used in the validation run.
#   BASE_PORT+0  onnxruntime-web/wasm entry, not cross-origin isolated (1 WASM thread)
#   BASE_PORT+1  onnxruntime-web/wasm entry, COOP/COEP (multithreaded WASM)
#   BASE_PORT+2  default onnxruntime-web entry (JSEP wasm), not isolated
# BASE_PORT defaults to 4321 (the results file used 4321-4323).
# MODELS_DIR, SAMPLES_DIR and OUT_DIR must point outside the repo.
cd "$(dirname "$0")"
: "${MODELS_DIR:?}" "${SAMPLES_DIR:?}" "${OUT_DIR:?}"
export MODELS_DIR SAMPLES_DIR OUT_DIR
# One random token shared by the three servers; give the same value to run.mjs.
if [ -z "${HARNESS_TOKEN:-}" ]; then
  HARNESS_TOKEN=$(node -e "console.log(require('crypto').randomBytes(24).toString('hex'))")
  echo "HARNESS_TOKEN=$HARNESS_TOKEN"
fi
export HARNESS_TOKEN
B=${BASE_PORT:-4321}
PORT=$B node server.mjs &
PORT=$((B + 1)) ISOLATE=1 node server.mjs &
PORT=$((B + 2)) ORT_ENTRY=default node server.mjs &
wait
