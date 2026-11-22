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

function Ensure-BusinessLanBinding {
    try {
        Import-Module WebAdministration -ErrorAction SilentlyContinue
        $sites = Get-Website -ErrorAction SilentlyContinue
        $bizSite = $null
        if ($sites) {
            $bizSite = $sites | Where-Object { 
                $_.PhysicalPath -like "*sri-nathi-business*" -or $_.Name -like "*Business*" -or $_.Name -like "*Console*" 
            } | Select-Object -First 1
        }
        $siteName = if ($bizSite) { $bizSite.Name } else { "SriNathi-BusinessConsole" }
        
        $hasBinding = Get-WebBinding -Name $siteName -Protocol "http" -Port 80 -ErrorAction SilentlyContinue | Where-Object { $_.bindingInformation -like "*10.30.0.11*" }
        if (-not $hasBinding) {
            New-WebBinding -Name $siteName -IPAddress "*" -Port 80 -HostHeader "10.30.0.11" -Force -ErrorAction SilentlyContinue | Out-Null
            Write-Host "Configured IIS binding http://10.30.0.11:80 for $siteName" -ForegroundColor Green
            iisreset /noforce 2>&1 | Out-Null
        }
        
        $appcmd = "$env:SystemRoot\System32\inetsrv\appcmd.exe"
        if (Test-Path $appcmd) {
            & $appcmd set site /site.name:"$siteName" /+bindings.[protocol='http',bindingInformation='*:80:10.30.0.11'] 2>$null | Out-Null
        }
        
        netsh advfirewall firewall add rule name="Sri Nathi Intranet Port 80" dir=in action=allow protocol=TCP localport=80 profile=any 2>&1 | Out-Null
    } catch {
        Write-Host "Notice ensuring LAN bindings: $_" -ForegroundColor Yellow
    }
}

while ($true) {
    try {
        Ensure-BusinessLanBinding
        Push-Location $targetDir
        git fetch origin main --quiet 2>$null
        $local = (git rev-parse HEAD 2>$null).Trim()
        $remote = (git rev-parse origin/main 2>$null).Trim()
        if ($local -and $remote -and ($local -ne $remote)) {
            Write-Host "Updating Business Console: $local -> $remote" -ForegroundColor Yellow
            git pull origin main
            Ensure-BusinessLanBinding
            Write-Host "Business Console successfully updated." -ForegroundColor Green
        }
    } catch {
        Write-Host "Error during pull: $_" -ForegroundColor Red
    } finally {
        Pop-Location
    }
    Start-Sleep -Seconds $IntervalSeconds
}
