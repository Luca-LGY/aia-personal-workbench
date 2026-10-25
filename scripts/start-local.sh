#!/bin/bash
set -euo pipefail
project_dir="$(cd "$(dirname "$0")/.." && pwd)"
electron_bin="$project_dir/node_modules/electron/dist/Electron.app/Contents/MacOS/Electron"
if [[ ! -x "$electron_bin" || ! -f "$project_dir/out/main/index.js" ]]; then
  echo '请先在工程目录运行 ./scripts/npmw run build。' >&2
  exit 1
fi
exec "$electron_bin" "$project_dir/out/main/index.js" "$@"
