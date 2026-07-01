#!/bin/bash
# LearnXR Firebase Hosting — native Vite production build (+ optional deploy).
#
# Toolchain on this Mac:
#   Node 22  → Vite/esbuild build  (Homebrew keg: /opt/homebrew/opt/node@22)
#   Node 25  → Firebase CLI only   (system: /opt/homebrew/bin/node)
#
# Usage:
#   ./firebase-build.sh              # build only → server/client/dist
#   ./firebase-build.sh deploy       # build + deploy preview channel
#   ./firebase-build.sh deploy live  # build + deploy live hosting on lexrn1
#
# Project: lexrn1  |  Site: altiereality  |  Config: firebase.lexrn1.json

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLIENT_DIR="$ROOT_DIR/server/client"
FIREBASE_CONFIG="$ROOT_DIR/firebase.lexrn1.json"
FIREBASE_PROJECT="lexrn1"

NODE22_BIN="${NODE22_BIN:-/opt/homebrew/opt/node@22/bin}"
NODE22="$NODE22_BIN/node"
NODE25="${NODE25:-/opt/homebrew/bin/node}"
FIREBASE_CLI="${FIREBASE_CLI:-/opt/homebrew/bin/firebase}"

log() { printf '[firebase-build] %s\n' "$*"; }
die() { printf '[firebase-build] ERROR: %s\n' "$*" >&2; exit 1; }

require_executable() {
  if [[ ! -x "$1" ]]; then
    die "Missing executable: $1"
  fi
}

build_client() {
  require_executable "$NODE22"

  log "node (build): $("$NODE22" -v)"
  log "cleaning previous dist..."
  rm -rf "$CLIENT_DIR/dist"

  export PATH="$NODE22_BIN:$PATH"
  export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=8192}"
  export CI=1

  log "running Vite production build (configLoader=runner)..."
  cd "$CLIENT_DIR"
  "$NODE22" node_modules/vite/bin/vite.js build --configLoader runner

  [[ -f "$CLIENT_DIR/dist/index.html" ]] \
    || die "Build finished but dist/index.html is missing"

  log "build complete → server/client/dist ($(du -sh "$CLIENT_DIR/dist" | awk '{print $1}'))"
}

deploy_hosting() {
  local target="${1:-preview}"
  require_executable "$NODE25"
  require_executable "$FIREBASE_CLI"
  [[ -f "$FIREBASE_CONFIG" ]] || die "Config not found: $FIREBASE_CONFIG"

  log "node (firebase): $("$NODE25" -v)"
  log "firebase: $("$NODE25" "$FIREBASE_CLI" --version)"
  log "project: $FIREBASE_PROJECT"

  cd "$ROOT_DIR"
  "$NODE25" "$FIREBASE_CLI" use "$FIREBASE_PROJECT"

  if [[ "$target" == "live" ]]; then
    log "deploying LIVE hosting (lexrn1 / altiereality)..."
    "$NODE25" "$FIREBASE_CLI" deploy --only hosting -c "$FIREBASE_CONFIG"
  else
    log "deploying PREVIEW channel '$target' (lexrn1 / altiereality)..."
    "$NODE25" "$FIREBASE_CLI" hosting:channel:deploy "$target" \
      -c "$FIREBASE_CONFIG" \
      --expires 30d
  fi
}

main() {
  local command="${1:-build}"

  case "$command" in
    build)
      build_client
      ;;
    deploy)
      build_client
      deploy_hosting "${2:-preview}"
      ;;
    *)
      die "Unknown command: $command (use: build | deploy | build-and-deploy)"
      ;;
  esac
}

main "$@"
