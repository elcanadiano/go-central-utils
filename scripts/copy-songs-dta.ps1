# Collect songs.dta files from each source subdirectory into numbered copies
# in the target directory (songs 1.dta, songs 2.dta, ...).
#
# Usage: .\scripts\copy-songs-dta.ps1 <source-dir> <target-dir>

param(
    [Parameter(Mandatory = $true, Position = 0)]
    [string]$SourceDir,

    [Parameter(Mandatory = $true, Position = 1)]
    [string]$TargetDir
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $SourceDir -PathType Container)) {
    Write-Error "Source directory does not exist: $SourceDir"
}

if (-not (Test-Path -LiteralPath $TargetDir -PathType Container)) {
    Write-Error "Target directory does not exist: $TargetDir"
}

$SourceDir = (Resolve-Path -LiteralPath $SourceDir).Path
$TargetDir = (Resolve-Path -LiteralPath $TargetDir).Path

$existing = @(
    Get-ChildItem -LiteralPath $TargetDir -File -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -match '^songs \d+\.dta$' }
)

if ($existing.Count -gt 0) {
    Write-Host "The following files in the target directory will be deleted:"
    foreach ($file in $existing) {
        Write-Host "  $($file.Name)"
    }
    Write-Host ""
    $answer = Read-Host "Delete these files and continue? [y/N]"
    if ($answer -notmatch '^[Yy]([Ee][Ss])?$') {
        Write-Host "Aborted."
        exit 1
    }
    $existing | Remove-Item
    Write-Host "Deleted $($existing.Count) file(s)."
}
else {
    Write-Host "No existing 'songs N.dta' files in the target directory."
}

$count = 0
$copied = 0
$skipped = 0

$dirs = @(
    Get-ChildItem -LiteralPath $SourceDir -Directory |
        Sort-Object -Property Name
)

foreach ($dir in $dirs) {
    $songsDir = Join-Path $dir.FullName "songs"
    $songsDta = Join-Path $songsDir "songs.dta"

    if (-not (Test-Path -LiteralPath $songsDir -PathType Container)) {
        $skipped++
        continue
    }

    if (-not (Test-Path -LiteralPath $songsDta -PathType File)) {
        Write-Host "Skipping $($dir.Name): songs/ exists but songs.dta is missing."
        $skipped++
        continue
    }

    $count++
    $dest = Join-Path $TargetDir "songs $count.dta"
    Copy-Item -LiteralPath $songsDta -Destination $dest
    Write-Host "Copied $($dir.Name)/songs/songs.dta -> songs $count.dta"
    $copied++
}

$skippedLabel = if ($skipped -eq 1) { "directory" } else { "directories" }
Write-Host ""
Write-Host "Done. Copied $copied file(s), skipped $skipped $skippedLabel."
