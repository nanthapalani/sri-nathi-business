<#
.SYNOPSIS
Continuous Git Pull Daemon for Sri Nathi Business Console
#>

param(
    [int]$IntervalSeconds = 30
)

$targetDir = "C:\inetpub\wwwroot\sri-nathi-business"
if (-not (Test-Path "$targetDir\.git")) {
    $targetDir = (Split-Path -Parent $MyInvocation.MyCommand.Definition)
}

Write-Host "Monitoring $targetDir every $IntervalSeconds seconds for updates..." -ForegroundColor Cyan

while ($true) {
    try {
        Push-Location $targetDir
        git fetch origin main --quiet 2>$null
        $local = (git rev-parse HEAD 2>$null).Trim()
        $remote = (git rev-parse origin/main 2>$null).Trim()
        if ($local -and $remote -and ($local -ne $remote)) {
            Write-Host "Updating Business Console: $local -> $remote" -ForegroundColor Yellow
            git pull origin main
            Write-Host "Business Console successfully updated." -ForegroundColor Green
        }
    } catch {
        Write-Host "Error during pull: $_" -ForegroundColor Red
    } finally {
        Pop-Location
    }
    Start-Sleep -Seconds $IntervalSeconds
}
