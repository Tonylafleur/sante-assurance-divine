param([string]$Service)

$base = Split-Path -Parent $MyInvocation.MyCommand.Path

function NeedsRebuild($dir, $marker, $excludePattern) {
    $markerPath = Join-Path $base $marker
    if (-not (Test-Path $markerPath)) { return $true }
    $markerTime = (Get-Item $markerPath).LastWriteTime
    $newest = Get-ChildItem -Recurse -File (Join-Path $base $dir) |
        Where-Object { $_.FullName -notmatch $excludePattern } |
        Sort-Object LastWriteTime -Descending |
        Select-Object -First 1
    return ($newest -and $newest.LastWriteTime -gt $markerTime)
}

$rebuildFront = NeedsRebuild "frontend" ".last_build_frontend" "node_modules"
$rebuildBack  = NeedsRebuild "backend"  ".last_build_backend"  "__pycache__"

if ($Service -eq "frontend") { if ($rebuildFront) { exit 1 } else { exit 0 } }
if ($Service -eq "backend")  { if ($rebuildBack)  { exit 1 } else { exit 0 } }

# Sans argument : retourner un code combiné
# 0=rien, 1=front, 2=back, 3=les deux
$code = 0
if ($rebuildFront) { $code += 1 }
if ($rebuildBack)  { $code += 2 }
exit $code
