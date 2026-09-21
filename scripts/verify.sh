#!/usr/bin/env bash
# Chạy toàn bộ kiểm tra của cả hai phần và DỪNG ngay khi có lỗi (mã thoát khác 0).
# Dùng: bash scripts/verify.sh
set -euo pipefail
cd "$(dirname "$0")/.."

step() { printf '\n== %s\n' "$1"; }

step "backend: prettier + eslint";  (cd backend && npx prettier --check src test >/dev/null && npx eslint src test)
step "backend: typecheck";          (cd backend && npx tsc --noEmit)
step "backend: unit tests";         (cd backend && npx jest 2>&1 | grep -E "^(Tests|Test Suites):")
step "backend: e2e tests";          (cd backend && npm run test:e2e 2>&1 | grep -E "^(Tests|Test Suites):")
step "frontend: lint";              (cd frontend && npx oxlint)
step "frontend: tests";             (cd frontend && npx vitest run 2>&1 | grep -E "Tests |Test Files")
step "frontend: typecheck + build"; (cd frontend && npm run build >/dev/null)

printf '\nTất cả kiểm tra đều đạt.\n'
