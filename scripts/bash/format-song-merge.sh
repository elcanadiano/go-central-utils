#!/usr/bin/env bash
# Run arson-fmt on each numbered songs N.dta file in song_merge/, then utf-8.py
# once on the song_merge directory.
#
# Usage: scripts/bash/format-song-merge.sh <directory>
#
# Expects:
#   <directory>/utf-8.py
#   <directory>/song_merge/songs 1.dta
#   <directory>/song_merge/songs 2.dta
#   ...
# and that arson-fmt and python are on PATH.
set -euo pipefail

usage() {
  echo "Usage: $0 <directory>" >&2
  exit 1
}

[[ $# -eq 1 ]] || usage

root_dir=$1

if [[ ! -d "$root_dir" ]]; then
  echo "Directory does not exist: $root_dir" >&2
  exit 1
fi

root_dir=$(cd -- "$root_dir" && pwd)
utf8_py=$root_dir/utf-8.py
song_merge=$root_dir/song_merge

if ! command -v arson-fmt >/dev/null 2>&1; then
  echo "arson-fmt is not on PATH." >&2
  exit 1
fi

if ! command -v python >/dev/null 2>&1; then
  echo "python is not on PATH." >&2
  exit 1
fi

if [[ ! -f "$utf8_py" ]]; then
  echo "utf-8.py not found in $root_dir" >&2
  exit 1
fi

if [[ ! -d "$song_merge" ]]; then
  echo "song_merge directory not found in $root_dir" >&2
  exit 1
fi

files=()
shopt -s nullglob
for file in "$song_merge"/songs\ *.dta; do
  [[ -f "$file" ]] || continue
  base=$(basename -- "$file")
  if [[ "$base" =~ ^songs\ [0-9]+\.dta$ ]]; then
    files+=("$file")
  fi
done
shopt -u nullglob

if ((${#files[@]} == 0)); then
  echo "No 'songs N.dta' files found in song_merge/." >&2
  exit 1
fi

mapfile -t files < <(printf '%s\n' "${files[@]}" | LC_ALL=C sort -t' ' -k2,2n)

for file in "${files[@]}"; do
  echo "Formatting $file"
  arson-fmt "$file"
done

echo "Converting $song_merge to UTF-8"
python "$utf8_py" "$song_merge"

echo
echo "Done. Formatted ${#files[@]} file(s)."
