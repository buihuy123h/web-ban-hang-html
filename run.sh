#!/usr/bin/env bash
# run.sh — Launcher nhanh cho dự án "Đồ Cũ Quang Huy" (Linux / macOS / Git Bash)
#
# Cách dùng:
#   ./run.sh                 mở menu (nếu chạy trong terminal tương tác)
#   ./run.sh <lệnh>          setup | dev | build | start | test | verify |
#                            smoke | deploy | crew | clean | help
#   ./run.sh clean deep      dọn thêm node_modules + crew/.venv (~900 MB)
#   ./run.sh crew "..."      chạy CrewAI, ví dụ: ./run.sh crew "tối ưu trang chủ"
#
# Lưu ý: file dùng LF + UTF-8 (không BOM) — .gitattributes đã khóa eol.

set -u
cd "$(dirname "$0")" || exit 1

c_info() { printf '\033[36m%s\033[0m\n' "$*"; }
c_ok()   { printf '\033[32m%s\033[0m\n' "$*"; }
c_err()  { printf '\033[31m%s\033[0m\n' "$*" >&2; }

# ------------------------------------------------------------- helpers
need_npm() {
  command -v npm >/dev/null 2>&1 || { c_err "[LỖI] Không tìm thấy npm — hãy cài Node.js 22+ (https://nodejs.org)."; return 1; }
}

need_deps() {
  if [ ! -d client/node_modules ] || [ ! -d server/node_modules ]; then
    c_err "[LỖI] Chưa cài dependencies — chạy trước: ./run.sh setup"
    return 1
  fi
}

health_ok() {
  command -v curl >/dev/null 2>&1 || return 1
  curl -sfm 3 http://localhost:3000/api/health >/dev/null 2>&1
}

# -------------------------------------------------------------- actions
cmd_setup() {
  need_npm || return 1
  c_info "[1/1] Cài dependencies cho client + server + tools (lần đầu có thể lâu 3-5 phút)…"
  npm run setup && c_ok "[OK] Setup xong. Chạy: ./run.sh dev (phát triển) hoặc ./run.sh start (chạy thật)."
}

cmd_dev() {
  need_npm && need_deps || return 1
  c_info "Đang chạy BE :3000 + FE :5173 — nhấn Ctrl+C để dừng cả hai…"
  if command -v powershell >/dev/null 2>&1 || command -v powershell.exe >/dev/null 2>&1; then
    npm run dev:server &
  else
    c_info "(Không có PowerShell — chạy server trực tiếp bằng node --watch)"
    ( cd server && exec node --watch index.js ) &
  fi
  BE_PID=$!
  sleep 1.5
  npm run dev:client &
  FE_PID=$!
  trap 'kill "$BE_PID" "$FE_PID" 2>/dev/null' EXIT INT TERM
  c_ok "[OK] Web dev: http://localhost:5173  ·  API: http://localhost:3000"
  wait
}

cmd_build() {
  need_npm && need_deps || return 1
  c_info "Build client production + nén Brotli/Gzip…"
  npm run build && c_ok "[OK] Build xong — client/dist đã sẵn sàng. Chạy: ./run.sh start"
}

cmd_start() {
  need_npm && need_deps || return 1
  if [ ! -f client/dist/index.html ]; then
    c_info "[i] Chưa có bản build — tự động build trước…"
    npm run build || return 1
  fi
  c_info "Website chạy tại http://localhost:3000 (Ctrl+C để dừng)"
  npm start
}

cmd_test() {
  need_npm && need_deps || return 1
  c_info "Chạy toàn bộ test API backend…"
  npm test && c_ok "[OK] Test pass."
}
cmd_verify() {
  need_npm && need_deps || return 1
  c_info 'VERIFY = test + build (bước "gate" bắt buộc trước khi release)'
  npm run verify && c_ok "[OK] Verify pass — sẵn sàng release/deploy."
}

cmd_smoke() {
  need_npm && need_deps || return 1
  if ! health_ok; then
    c_err "[LỖI] Server chưa chạy tại :3000 — mở terminal khác: ./run.sh start"
    return 1
  fi
  npm run smoke
}

cmd_deploy() {
  need_npm && need_deps || return 1
  if [ -f server/scripts/deploy.ps1 ] && { command -v powershell.exe >/dev/null 2>&1 || command -v powershell >/dev/null 2>&1; }; then
    c_info "Deploy: test - build - precompress - restart - health check…"
    npm run deploy
  else
    c_info "deploy.ps1 là Windows-only — chạy bản rút gọn: verify (+ start nếu server chưa chạy)…"
    npm run verify || return 1
    if health_ok; then
      c_ok "[OK] Server đã đang chạy — không restart."
    else
      c_info "Khởi động server nền (log: server.log)…"
      nohup npm start > server.log 2>&1 &
      c_ok "[OK] Đã khởi động (pid $!). Xem log: tail -f server.log"
    fi
  fi
}

cmd_crew() {
  local req="${1:-}"
  if [ -z "$req" ]; then
    read -r -p "Nhập yêu cầu cho crew: " req || return 1
  fi
  if [ -z "$req" ]; then
    c_err '[LỖI] Chưa nhập yêu cầu. Ví dụ: ./run.sh crew "thêm mã giảm giá"'
    return 1
  fi
  if [ -x crew/.venv/Scripts/python.exe ]; then
    crew/.venv/Scripts/python.exe crew/crew.py "$req"
  elif [ -x crew/.venv/bin/python ]; then
    crew/.venv/bin/python crew/crew.py "$req"
  else
    c_err "[LỖI] Chưa cài crew venv — hướng dẫn (xem crew/README.md):"
    c_err "  1. python -m venv crew/.venv"
    c_err "  2. crew/.venv/bin/pip install -r crew/requirements.txt"
    c_err "  3. copy crew/.env.example → crew/.env rồi điền API key"
    return 1
  fi
}

clean_deep() {
  rm -rf client/node_modules server/node_modules tools/node_modules crew/.venv
  c_ok "[OK] Đã xóa node_modules (client/server/tools) + crew/.venv. Chạy lại: ./run.sh setup"
}

cmd_clean() {
  local mode="${1:-}"
  c_info "Đang dọn dẹp (an toàn — chỉ xóa file tái tạo được)…"
  rm -rf client/dist client/node_modules/.vite
  find tools/artifacts -mindepth 1 ! -name .gitkeep -delete 2>/dev/null
  rm -f cur-*.png *.log 2>/dev/null
  c_ok "[OK] Đã dọn: client/dist, cache Vite, tools/artifacts (giữ .gitkeep), log, ảnh chụp gốc."
  if [ "$mode" = "deep" ]; then
    clean_deep
  elif [ -t 0 ]; then
    local ans=""
    read -r -p "Xóa thêm node_modules + crew/.venv (~900 MB, phải cài lại)? [y/N] " ans || return 0
    if [ "$ans" = "y" ] || [ "$ans" = "Y" ]; then clean_deep; fi
  else
    c_info "Bỏ qua deep clean — chạy './run.sh clean deep' nếu muốn."
  fi
}

# -------------------------------------------------------- usage & menu
usage() {
  cat <<'EOF'
Đồ Cũ Quang Huy — launcher nhanh
Cách dùng: ./run.sh <lệnh>
  setup             Cài dependencies lần đầu (client + server + tools)
  dev               Chạy dev: BE :3000 + FE :5173
  build             Build production (Vite + nén Brotli/Gzip)
  start             Chạy web production tại :3000 (tự build nếu thiếu)
  test              Chạy toàn bộ test API backend
  verify            Gate trước release: test + build
  smoke             Smoke test UI Playwright (cần server đang chạy)
  deploy            Test → build → restart → health check
  crew "<yêu cầu>"  Chạy crew AI quy trình 4 giai đoạn
  clean [deep]      Dọn file tạm/build; deep = xóa thêm node_modules + crew/.venv
  help              Xem hướng dẫn này

Windows: dùng run.bat (nhấn đúp để mở menu).
EOF
}

menu() {
  while true; do
    echo "=================================================="
    echo "  ĐỒ CŨ QUANG HUY — TRÌNH KHỞI CHẠY NHANH"
    echo "=================================================="
    echo "  [1] Cài đặt lần đầu ............ setup"
    echo "  [2] Chạy dev (BE + FE) ......... dev"
    echo "  [3] Build production ........... build"
    echo "  [4] Chạy web production ........ start"
    echo "  [5] Test API ................... test"
    echo "  [6] Verify (test + build) ...... verify"
    echo "  [7] Smoke test UI .............. smoke"
    echo "  [8] Deploy ..................... deploy"
    echo "  [9] CrewAI ..................... crew"
    echo "  [10] Dọn dẹp file rác .......... clean"
    echo "  [0] Thoát"
    echo "=================================================="
    local c=""
    read -r -p "Chọn chức năng: " c || exit 0
    case "$c" in
      1) cmd_setup ;;
      2) cmd_dev ;;
      3) cmd_build ;;
      4) cmd_start ;;
      5) cmd_test ;;
      6) cmd_verify ;;
      7) cmd_smoke ;;
      8) cmd_deploy ;;
      9) cmd_crew ;;
      10) cmd_clean ;;
      0) exit 0 ;;
      *) echo "Lựa chọn không hợp lệ." ;;
    esac
    echo
    read -r -p "Nhấn Enter để quay lại menu…" _ || exit 0
  done
}

main() {
  local cmd="${1:-}"
  case "$cmd" in
    setup|dev|build|start|test|verify|smoke|deploy) "cmd_$cmd" ;;
    clean) shift; cmd_clean "$@" ;;
    crew)  shift; cmd_crew "$@" ;;
    help|-h|--help) usage ;;
    "") if [ -t 0 ]; then menu; else usage; fi ;;
    *)
      c_err "Lệnh không hợp lệ: $cmd"
      usage
      exit 2
      ;;
  esac
}

main "$@"

