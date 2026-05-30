#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd -- "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
python_win_path="$(
  where.exe python 2>/dev/null \
    | tr -d '\r' \
    | awk '!/WindowsApps/ { print; exit }'
)"

if [[ -z "${python_win_path}" ]]; then
  echo "未找到可用的 Python 解释器，请安装 Python 或把真实 python.exe 加入 PATH。" >&2
  exit 1
fi

python_unix_path="$(cygpath -u "${python_win_path}")"
exec "${python_unix_path}" "${script_dir}/slide.py" "$@"
