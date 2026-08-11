# Run arson-fmt on each numbered songs N.dta file in song_merge/, then utf-8.py
# once on the song_merge directory.
#
# Usage: .\scripts\powershell\format-song-merge.ps1 <directory>
#
# Expects:
#   <directory>\utf-8.py
#   <directory>\song_merge\songs 1.dta
#   <directory>\song_merge\songs 2.dta
#   ...
# and that arson-fmt and python are on PATH.

param(
    [Parameter(Mandatory = $true, Position = 0)]
    [string]$Directory
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $Directory -PathType Container)) {
    Write-Error "Directory does not exist: $Directory"
}

$rootDir = (Resolve-Path -LiteralPath $Directory).Path

if (-not (Get-Command arson-fmt -ErrorAction SilentlyContinue)) {
    Write-Error "arson-fmt is not on PATH."
}

if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
    Write-Error "python is not on PATH."
}

$utf8Py = Join-Path $rootDir "utf-8.py"
if (-not (Test-Path -LiteralPath $utf8Py -PathType Leaf)) {
    Write-Error "utf-8.py not found in $rootDir"
}

$songMerge = Join-Path $rootDir "song_merge"
if (-not (Test-Path -LiteralPath $songMerge -PathType Container)) {
    Write-Error "song_merge directory not found in $rootDir"
}

$files = @(
    Get-ChildItem -LiteralPath $songMerge -File -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -match '^songs \d+\.dta$' } |
        Sort-Object { [int]($_.Name -replace '^songs (\d+)\.dta$', '$1') }
)

if ($files.Count -eq 0) {
    Write-Error "No 'songs N.dta' files found in song_merge/."
}

foreach ($file in $files) {
    Write-Host "Formatting $($file.FullName)"
    & arson-fmt $file.FullName
}

Write-Host "Converting $songMerge to UTF-8"
& python $utf8Py $songMerge

Write-Host ""
Write-Host "Done. Formatted $($files.Count) file(s)."
