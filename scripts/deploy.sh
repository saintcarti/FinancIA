#!/usr/bin/env bash
# FinancIA Chile — deploy script
# Requiere: vercel CLI + railway CLI logueados.
# Uso: ./scripts/deploy.sh [backend|frontend|all]
set -e

TARGET="${1:-all}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND="$ROOT/03_BUILD/app/backend"
FRONTEND="$ROOT/03_BUILD/app/frontend"

# ── helpers ─────────────────────────────────────────────────
function info() { printf "\033[1;34m[deploy]\033[0m %s\n" "$1"; }
function ok()   { printf "\033[1;32m✓\033[0m %s\n" "$1"; }
function fail() { printf "\033[1;31m✗\033[0m %s\n" "$1" >&2; exit 1; }

# ── pre-checks ──────────────────────────────────────────────
function check_tool() {
  command -v "$1" >/dev/null 2>&1 || fail "$1 no instalado. Instalar: $2"
}

function deploy_backend() {
  info "Backend → Railway"
  cd "$BACKEND"

  info "tsc --noEmit"
  npx tsc --noEmit || fail "TypeScript errors. Arreglar antes de deploy."

  info "vitest"
  npm test -- --run || fail "Tests fallaron."

  info "railway up"
  check_tool "railway" "npm i -g @railway/cli"
  railway up || fail "Railway deploy falló"
  ok "Backend deployado"
}

function deploy_frontend() {
  info "Frontend → Vercel"
  cd "$FRONTEND"

  info "next build (sanity check)"
  npm run build || fail "next build falló"

  info "vercel --prod"
  check_tool "vercel" "npm i -g vercel"
  vercel --prod --yes || fail "Vercel deploy falló"
  ok "Frontend deployado"
}

function smoke_tests() {
  info "Smoke tests post-deploy"
  if [[ -z "$API_URL" ]]; then
    info "API_URL no seteado, skip smoke tests"
    return
  fi
  curl -fsS "$API_URL/api/health" >/dev/null && ok "/api/health OK" || fail "/api/health DOWN"
  curl -fsS "$API_URL/api/cmf/uf" >/dev/null && ok "/api/cmf/uf OK" || fail "CMF UF endpoint DOWN"
}

case "$TARGET" in
  backend)  deploy_backend; smoke_tests ;;
  frontend) deploy_frontend ;;
  all)      deploy_backend; deploy_frontend; smoke_tests ;;
  *) fail "Uso: ./scripts/deploy.sh [backend|frontend|all]" ;;
esac

ok "Deploy completo."
