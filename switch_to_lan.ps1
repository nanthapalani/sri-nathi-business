<#
.SYNOPSIS
Switches the Sri Nathi Business Administration Console to Private Local Network (LAN) mode.
.DESCRIPTION
Run this PowerShell script as Administrator on your Windows Server.
It reconfigures the IIS site to listen on Port 8085 without host header restrictions,
and creates a Windows Firewall rule allowing access only from the local network (LocalSubnet).
#>

param(
    [int]$Port = 8085,
    [string]$SiteName = "SriNathi-BusinessConsole"
)

# Requires Administrator Elevation
if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Host "[ERROR] This script must be run as Administrator!" -ForegroundColor Red
    Write-Host "Please right-click PowerShell and select 'Run as Administrator'." -ForegroundColor Yellow
    Pause
    Exit
}

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  SRI NATHI - SWITCH BUSINESS CONSOLE TO LOCAL NETWORK (LAN)" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan

Import-Module WebAdministration -ErrorAction SilentlyContinue

# 1. Verify Site Exists
if (-not (Get-Website -Name $SiteName -ErrorAction SilentlyContinue)) {
    Write-Host "[ERROR] IIS Website '$SiteName' not found!" -ForegroundColor Red
    Write-Host "Please ensure the site is created first." -ForegroundColor Yellow
    Pause
    Exit
}

# 2. Update IIS Binding to Dedicated LAN Port (No Host Header)
Write-Host "`n[1/3] Updating IIS site binding to Port $Port (all local network interfaces)..." -ForegroundColor Yellow

# Clear existing bindings
Get-WebBinding -Name $SiteName | ForEach-Object {
    Remove-WebBinding -Name $SiteName -BindingInformation $_.bindingInformation
}

# Add fresh HTTP binding on Port with no host header restriction
New-WebBinding -Name $SiteName -IPAddress "*" -Port $Port -Protocol "http" -Force | Out-Null
Write-Host "IIS binding updated to: http://*:$Port/" -ForegroundColor Green

# 3. Configure Windows Firewall for Local Subnet Only
Write-Host "`n[2/3] Configuring Windows Firewall to allow Port $Port on Local Network..." -ForegroundColor Yellow
Remove-NetFirewallRule -DisplayName "Sri Nathi Business Console (LAN)" -ErrorAction SilentlyContinue

New-NetFirewallRule -DisplayName "Sri Nathi Business Console (LAN)" `
    -Direction Inbound `
    -LocalPort $Port `
    -Protocol TCP `
    -Action Allow `
    -Profile Private, Domain `
    -RemoteAddress LocalSubnet `
    -Description "Allows incoming traffic to Sri Nathi Business Console exclusively from local LAN devices." | Out-Null

Write-Host "Firewall rule created (restricted to LocalSubnet on Private/Domain profiles)." -ForegroundColor Green

# 4. Detect Local IP Address
Write-Host "`n[3/3] Detecting Server Local IP Address..." -ForegroundColor Yellow
$localIp = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { 
    $_.InterfaceAlias -notmatch "Loopback" -and $_.IPAddress -notmatch "^169\.254" 
} | Select-Object -First 1).IPAddress

# Restart the IIS site
Restart-WebItem "IIS:\Sites\$SiteName" -ErrorAction SilentlyContinue

Write-Host "`n============================================================" -ForegroundColor Green
Write-Host "  SUCCESS! BUSINESS CONSOLE IS NOW RUNNING ON LOCAL NETWORK" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green
Write-Host "`nHow to access the Business Console:" -ForegroundColor Cyan
Write-Host "  On this Server machine:  http://localhost:$Port" -ForegroundColor White
if ($localIp) {
    Write-Host "  From any device on LAN:   http://${localIp}:${Port}" -ForegroundColor White
}
Write-Host "`nSecurity Status:" -ForegroundColor Cyan
Write-Host "  + Completely hidden from the public internet (Zero Trust)." -ForegroundColor Green
Write-Host "  + Public sites (web.srinathi.in, etc.) remain online and untouched." -ForegroundColor Green
Write-Host "  + Controls all live data and systems directly on 127.0.0.1:8000." -ForegroundColor Green
Write-Host "`nPress any key to exit..."
$Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown') | Out-Null
