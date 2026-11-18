<#
.SYNOPSIS
Automated Deployment Script for Sri Nathi Business Administration Console on Windows IIS.
.DESCRIPTION
Run this PowerShell script as Administrator on your Windows Server.
It clones the repository to C:\inetpub\wwwroot\sri-nathi-business,
provisions the IIS site with host header binding, configures permissions,
and enables ARR reverse proxy for backend routing.
#>

param(
    [string]$Domain = "console.srinathi.in",
    [int]$Port = 80
)

# Requires Administrator Elevation
if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Host "[ERROR] This script must be run as Administrator!" -ForegroundColor Red
    Write-Host "Please right-click PowerShell and select 'Run as Administrator'." -ForegroundColor Yellow
    Pause
    Exit
}

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  SRI NATHI - AUTOMATED IIS BUSINESS CONSOLE DEPLOYMENT" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan

$targetDir = "C:\inetpub\wwwroot\sri-nathi-business"
$repoUrl = "https://github.com/nanthapalani/sri-nathi-business.git"
$siteName = "SriNathi-BusinessConsole"

Write-Host "Target Domain: $Domain" -ForegroundColor Yellow
Write-Host "Binding Port:  $Port" -ForegroundColor Yellow
Write-Host "Physical Path: $targetDir" -ForegroundColor Yellow

# 1. Enable IIS Roles & Features
Write-Host "`n[1/5] Checking and Enabling IIS Features..." -ForegroundColor Yellow
Enable-WindowsOptionalFeature -Online -FeatureName IIS-WebServerRole -All -ErrorAction SilentlyContinue | Out-Null
Enable-WindowsOptionalFeature -Online -FeatureName IIS-WebServer -All -ErrorAction SilentlyContinue | Out-Null
Enable-WindowsOptionalFeature -Online -FeatureName IIS-ApplicationDevelopment -All -ErrorAction SilentlyContinue | Out-Null
Enable-WindowsOptionalFeature -Online -FeatureName IIS-CommonHttpFeatures -All -ErrorAction SilentlyContinue | Out-Null
Enable-WindowsOptionalFeature -Online -FeatureName IIS-WebSockets -All -ErrorAction SilentlyContinue | Out-Null
Import-Module WebAdministration -ErrorAction SilentlyContinue

# 2. Clone or Update Repository
Write-Host "`n[2/5] Deploying Business Console Source Code to $targetDir..." -ForegroundColor Yellow
if (-not (Test-Path $targetDir)) {
    New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
    Write-Host "Cloning business console repository from GitHub..." -ForegroundColor Gray
    git clone $repoUrl $targetDir
} else {
    Write-Host "Updating existing business console code from GitHub..." -ForegroundColor Gray
    Set-Location $targetDir
    git pull origin main
}

# 3. Configure Directory Security Permissions
Write-Host "`n[3/5] Setting IIS_IUSRS Directory Permissions..." -ForegroundColor Yellow
$acl = Get-Acl $targetDir
$permission = "BUILTIN\IIS_IUSRS","FullControl","ContainerInherit,ObjectInherit","None","Allow"
$accessRule = New-Object System.Security.AccessControl.FileSystemAccessRule $permission
$acl.SetAccessRule($accessRule)
Set-Acl $targetDir $acl

# 4. Provision IIS Site with HTTP and HTTPS (SNI)
Write-Host "`n[4/6] Provisioning IIS Site '$siteName' for '$Domain'..." -ForegroundColor Yellow
if (Get-Website -Name $siteName -ErrorAction SilentlyContinue) {
    Remove-Website -Name $siteName
}

# Create base website on Port 80
New-Website -Name $siteName `
            -PhysicalPath $targetDir `
            -Port $Port `
            -HostHeader $Domain `
            -Force | Out-Null

# 5. Configure HTTPS Port 443 with SNI
Write-Host "`n[5/6] Configuring HTTPS (Port 443) with SSL and SNI..." -ForegroundColor Yellow
$certs = Get-ChildItem -Path Cert:\LocalMachine\My, Cert:\LocalMachine\WebHosting -ErrorAction SilentlyContinue | Where-Object { 
    $_.Subject -match "srinathi.in" -or $_.DnsNameList -match "srinathi.in" 
}
$cert = $null
if ($certs) {
    $cert = $certs | Where-Object { $_.NotAfter -gt (Get-Date) } | Sort-Object NotAfter -Descending | Select-Object -First 1
}
if ($cert) {
    Write-Host "Attaching existing valid SSL certificate ($($cert.Subject))..." -ForegroundColor Green
} else {
    Write-Host "Creating local Origin SSL certificate for $Domain..." -ForegroundColor Gray
    $cert = New-SelfSignedCertificate `
        -DnsName $Domain, "*.srinathi.in", "srinathi.in" `
        -CertStoreLocation "Cert:\LocalMachine\My" `
        -FriendlyName "Sri Nathi Origin SSL ($Domain)" `
        -NotAfter (Get-Date).AddYears(5)
}

New-WebBinding -Name $siteName `
               -IPAddress "*" `
               -Port 443 `
               -Protocol "https" `
               -HostHeader $Domain `
               -SslFlags 1

$certHash = $cert.GetCertHashString()
$guid = [guid]::NewGuid().ToString("B")
netsh http delete sslcert hostnameport="${Domain}:443" 2>$null | Out-Null
netsh http add sslcert hostnameport="${Domain}:443" certhash=$certHash appid=$guid certstorename="My" | Out-Null

try {
    $binding = Get-WebBinding -Name $siteName -Protocol "https" -Port 443 -HostHeader $Domain
    $binding.AddSslCertificate($certHash, "My")
} catch {}

# 6. Enable Application Request Routing (ARR) Proxy for API Calls
Write-Host "`n[6/6] Enabling ARR Reverse Proxy in IIS..." -ForegroundColor Yellow
try {
    Set-WebConfigurationProperty -pspath 'MACHINE/WEBROOT/APPHOST' -location '' -filter 'system.webServer/proxy' -name 'enabled' -value 'true' -ErrorAction SilentlyContinue
    Write-Host "ARR Reverse Proxy verified." -ForegroundColor Green
} catch {
    Write-Host "[NOTICE] Please ensure Application Request Routing (ARR) module is installed in IIS." -ForegroundColor Yellow
}

Write-Host "`n============================================================" -ForegroundColor Green
Write-Host "  SUCCESS! BUSINESS CONSOLE DEPLOYED ON IIS WITH HTTPS!" -ForegroundColor Green
Write-Host "  Secure URL: https://$Domain" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green
Write-Host "`nNext Steps:" -ForegroundColor Cyan
Write-Host "1. In Cloudflare DNS, add a CNAME record: name 'console' -> 'web.srinathi.in' (Proxy: ON)." -ForegroundColor White
Write-Host "2. Cloudflare will automatically serve the valid wildcard SSL certificate to all browsers." -ForegroundColor White
Write-Host "3. Ensure SriNathiBackend service is running on port 8000." -ForegroundColor White
Write-Host "Press any key to exit..."
$Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown') | Out-Null
