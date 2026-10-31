#!/bin/bash
# Start the three harness configurations used in the validation run.
#   4321  onnxruntime-web/wasm entry, not cross-origin isolated (1 WASM thread)
#   4322  onnxruntime-web/wasm entry, COOP/COEP (multithreaded WASM)
#   4323  default onnxruntime-web entry (JSEP wasm), not isolated
# MODELS_DIR, SAMPLES_DIR and OUT_DIR must point outside the repo.
cd "$(dirname "$0")"
: "${MODELS_DIR:?}" "${SAMPLES_DIR:?}" "${OUT_DIR:?}"
export MODELS_DIR SAMPLES_DIR OUT_DIR
PORT=4321 node server.mjs &
PORT=4322 ISOLATE=1 node server.mjs &
PORT=4323 ORT_ENTRY=default node server.mjs &
wait
