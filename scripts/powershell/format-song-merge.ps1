# Run arson-fmt and utf8.py on each numbered songs N.dta file in song_merge/.
#
# Usage: .\scripts\powershell\format-song-merge.ps1 <directory>
#
# Expects:
#   <directory>\utf8.py
#   <directory>\song_merge\songs 1.dta
#   <directory>\song_merge\songs 2.dta
#   ...
# and that arson-fmt is on PATH.

param(
    [Parameter(Mandatory = $true, Position = 0)]
    [string]$Directory
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $Directory -PathType Container)) {
    Write-Error "Directory does not exist: $Directory"
}

$rootDir = (Resolve-Path -LiteralPath $Directory).Path
Set-Location -LiteralPath $rootDir

if (-not (Get-Command arson-fmt -ErrorAction SilentlyContinue)) {
    Write-Error "arson-fmt is not on PATH."
}

$utf8Py = Join-Path $rootDir "utf8.py"
if (-not (Test-Path -LiteralPath $utf8Py -PathType File)) {
    Write-Error "utf8.py not found in $rootDir"
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
    $rel = "song_merge/$($file.Name)"
    Write-Host "Processing $rel"
    & arson-fmt $rel
    & .\utf8.py $rel
}

Write-Host ""
Write-Host "Done. Processed $($files.Count) file(s)."
