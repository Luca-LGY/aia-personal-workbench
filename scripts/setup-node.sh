#!/bin/sh
set -eu
project_root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
if [ -x "$project_root/.tooling/node/bin/node" ]; then
  "$project_root/.tooling/node/bin/node" --version
  exit 0
fi
printf '%s\n' 'Install verified Node 24 LTS into .tooling/node, or restore the project development toolchain as described in docs/audit/environment.md.'
exit 1
