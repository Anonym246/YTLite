#!/usr/bin/env bash
# Lädt die volle Stockfish-19-Engine (≈94 MB, stärkeres Netz) aus dem npm-Paket "stockfish"
# und legt sie in ../engine/ ab. Benötigt npm.
set -euo pipefail
VERSION="${1:-19.0.1}"
DIR="$(cd "$(dirname "$0")/.." && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
cd "$TMP"
npm pack "stockfish@${VERSION}" >/dev/null
tar xzf "stockfish-${VERSION}.tgz"
cp package/bin/stockfish-19-single.js package/bin/stockfish-19-single.wasm "$DIR/engine/"
echo "Fertig: engine/stockfish-19-single.{js,wasm}"
