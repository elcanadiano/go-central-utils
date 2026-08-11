#!/usr/bin/env bash
# Collect songs.dta files from each source subdirectory into numbered copies
# in the target directory (songs 1.dta, songs 2.dta, ...).
#
# Usage: scripts/copy-songs-dta.sh <source-dir> <target-dir>
set -euo pipefail

usage() {
  echo "Usage: $0 <source-dir> <target-dir>" >&2
  exit 1
}

[[ $# -eq 2 ]] || usage

source_dir=$1
target_dir=$2

if [[ ! -d "$source_dir" ]]; then
  echo "Source directory does not exist: $source_dir" >&2
  exit 1
fi

if [[ ! -d "$target_dir" ]]; then
  echo "Target directory does not exist: $target_dir" >&2
  exit 1
fi

source_dir=$(cd -- "$source_dir" && pwd)
target_dir=$(cd -- "$target_dir" && pwd)

existing=()
shopt -s nullglob
for file in "$target_dir"/songs\ *.dta; do
  [[ -f "$file" ]] || continue
  base=$(basename -- "$file")
  if [[ "$base" =~ ^songs\ [0-9]+\.dta$ ]]; then
    existing+=("$file")
  fi
done
shopt -u nullglob

if ((${#existing[@]} > 0)); then
  echo "The following files in the target directory will be deleted:"
  printf '  %s\n' "${existing[@]##*/}"
  echo
  read -r -p "Delete these files and continue? [y/N] " answer
  if [[ ! $answer =~ ^[Yy]([Ee][Ss])?$ ]]; then
    echo "Aborted."
    exit 1
  fi
  rm -f -- "${existing[@]}"
  echo "Deleted ${#existing[@]} file(s)."
else
  echo "No existing 'songs N.dta' files in the target directory."
fi

count=0
copied=0
skipped=0

while IFS= read -r -d '' dir; do
  songs_dir=$dir/songs
  songs_dta=$songs_dir/songs.dta

  if [[ ! -d "$songs_dir" ]]; then
    skipped=$((skipped + 1))
    continue
  fi

  if [[ ! -f "$songs_dta" ]]; then
    echo "Skipping $(basename -- "$dir"): songs/ exists but songs.dta is missing."
    skipped=$((skipped + 1))
    continue
  fi

  count=$((count + 1))
  dest=$target_dir/songs\ $count.dta
  cp -- "$songs_dta" "$dest"
  echo "Copied $(basename -- "$dir")/songs/songs.dta -> songs $count.dta"
  copied=$((copied + 1))
done < <(find "$source_dir" -mindepth 1 -maxdepth 1 -type d -print0 | LC_ALL=C sort -z)

echo
echo "Done. Copied $copied file(s), skipped $skipped directories."
