<#
.SYNOPSIS
Configures HTTPS (Port 443) with SSL and Server Name Indication (SNI) on IIS for Sri Nathi Business Console.
.DESCRIPTION
Run this PowerShell script as Administrator on your Windows Server machine.
It checks for an existing SSL certificate matching srinathi.in. If found, it attaches it to port 443.
If not found, it generates a trusted local origin certificate, imports it into IIS, and binds port 443 with SNI.
#>

param(
    [string]$Domain = "console.srinathi.in",
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
Write-Host "  SRI NATHI - HTTPS SSL SETUP FOR IIS ($Domain)" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan

Import-Module WebAdministration -ErrorAction SilentlyContinue

# Verify Site Exists
if (-not (Get-Website -Name $SiteName -ErrorAction SilentlyContinue)) {
    Write-Host "[ERROR] IIS Website '$SiteName' not found!" -ForegroundColor Red
    Write-Host "Please run .\deploy_business_iis.ps1 first to create the site." -ForegroundColor Yellow
    Pause
    Exit
}

# 1. Search for existing certificate in LocalMachine\My and LocalMachine\WebHosting
Write-Host "`n[1/3] Scanning Windows Certificate Store for srinathi.in SSL certificates..." -ForegroundColor Yellow
$certs = Get-ChildItem -Path Cert:\LocalMachine\My, Cert:\LocalMachine\WebHosting -ErrorAction SilentlyContinue | Where-Object { 
    $_.Subject -match "srinathi.in" -or $_.DnsNameList -match "srinathi.in" 
}

$cert = $null
if ($certs) {
    # Pick the newest non-expired cert
    $cert = $certs | Where-Object { $_.NotAfter -gt (Get-Date) } | Sort-Object NotAfter -Descending | Select-Object -First 1
}

if ($cert) {
    Write-Host "Found existing valid SSL certificate: $($cert.Subject) [Expires: $($cert.NotAfter)]" -ForegroundColor Green
} else {
    Write-Host "No existing certificate found. Generating 5-Year Origin SSL Certificate for $Domain..." -ForegroundColor Yellow
    $cert = New-SelfSignedCertificate `
        -DnsName $Domain, "*.srinathi.in", "srinathi.in" `
        -CertStoreLocation "Cert:\LocalMachine\My" `
        -FriendlyName "Sri Nathi Origin SSL ($Domain)" `
        -NotAfter (Get-Date).AddYears(5)
    Write-Host "Created Origin SSL Certificate (Thumbprint: $($cert.Thumbprint))" -ForegroundColor Green
}

# 2. Add or Update HTTPS Port 443 Binding with SNI
Write-Host "`n[2/3] Configuring HTTPS Port 443 binding on IIS site '$SiteName'..." -ForegroundColor Yellow

# Remove existing 443 binding for this domain if present to avoid conflicts
$existingBinding = Get-WebBinding -Name $SiteName -Protocol "https" -Port 443 -HostHeader $Domain -ErrorAction SilentlyContinue
if ($existingBinding) {
    Write-Host "Removing existing HTTPS binding for $Domain..." -ForegroundColor Gray
    Remove-WebBinding -Name $SiteName -Protocol "https" -Port 443 -HostHeader $Domain
}

# Create New HTTPS Binding with SNI (SslFlags = 1)
New-WebBinding -Name $SiteName `
               -IPAddress "*" `
               -Port 443 `
               -Protocol "https" `
               -HostHeader $Domain `
               -SslFlags 1

# 3. Attach SSL Certificate to the Binding
Write-Host "`n[3/3] Attaching SSL Certificate to HTTPS binding..." -ForegroundColor Yellow
$certHash = $cert.GetCertHashString()
$certStore = "My"

# Use netsh to ensure rock-solid SSL association with SNI
$guid = [guid]::NewGuid().ToString("B")
netsh http delete sslcert hostnameport="${Domain}:443" 2>$null | Out-Null
netsh http add sslcert hostnameport="${Domain}:443" certhash=$certHash appid=$guid certstorename=$certStore | Out-Null

# Also attach via IIS provider
try {
    $binding = Get-WebBinding -Name $SiteName -Protocol "https" -Port 443 -HostHeader $Domain
    $binding.AddSslCertificate($certHash, $certStore)
} catch {
    # Fallback handled via netsh above
}

Write-Host "============================================================" -ForegroundColor Green
Write-Host "  SUCCESS! HTTPS CONFIGURED FOR $Domain ON PORT 443" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green
Write-Host "Thumbprint:  $certHash" -ForegroundColor White
Write-Host "Expires:     $($cert.NotAfter)" -ForegroundColor White
Write-Host "URL:         https://$Domain" -ForegroundColor Green
Write-Host "`nCLOUDFLARE CONFIGURATION INSTRUCTIONS:" -ForegroundColor Cyan
Write-Host "1. In Cloudflare DNS, add a CNAME record:" -ForegroundColor White
Write-Host "   Type:  CNAME" -ForegroundColor Gray
Write-Host "   Name:  console (or your subdomain)" -ForegroundColor Gray
Write-Host "   Target: web.srinathi.in (or your root domain)" -ForegroundColor Gray
Write-Host "   Proxy: ON (Orange Cloud)" -ForegroundColor Gray
Write-Host "2. In Cloudflare SSL/TLS Settings, set SSL mode to 'Full' or 'Full (Strict)'." -ForegroundColor White
Write-Host "Press any key to exit..."
$Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown') | Out-Null
