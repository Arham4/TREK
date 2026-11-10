# Brief pause for adapter/DHCP settlement
Start-Sleep -Seconds 2

$UpnpExe     = "C:\tools\upnpc.exe"
$LeaseTime   = 120
$Port        = 3001
$Proto       = "TCP"
$Description = "TREK"

# Find active LAN IP (Ethernet preferred, Wi-Fi fallback)
$ethIp = (Get-NetIPAddress -InterfaceAlias 'Ethernet*' -AddressFamily IPv4 -ErrorAction SilentlyContinue |
          Where-Object { $_.IPAddress -like "192.168.1.*" -and $_.IPAddress -notlike "169.254.*" }).IPAddress | Select-Object -First 1

if ($ethIp) {
    $activeIp = $ethIp
    $mode     = "Ethernet"
} else {
    $activeIp = (Get-NetIPAddress -InterfaceAlias 'Wi-Fi*' -AddressFamily IPv4 -ErrorAction SilentlyContinue |
                 Where-Object { $_.IPAddress -like "192.168.1.*" -and $_.IPAddress -notlike "169.254.*" }).IPAddress | Select-Object -First 1
    $mode     = "Wi-Fi"
}

if (-not $activeIp) {
    Write-Host "No active 192.168.1.* LAN IP found." -ForegroundColor Red
    exit 1
}

# Bind UPnP port forwarding for TREK with conflict resolution
$maxRetries = 8
$attempt    = 0
$bound      = $false

while (-not $bound -and $attempt -lt $maxRetries) {
    $attempt++

    # Clear rule first if held by this IP
    & $UpnpExe -m $activeIp -d $Port $Proto 2>$null | Out-Null

    # Explicitly bind discovery and mapping to $activeIp
    $output = (& $UpnpExe -m $activeIp -e $Description -a $activeIp $Port $Port $Proto $LeaseTime 2>&1 | Out-String)

    if ($output -match "is redirected to internal $activeIp") {
        Write-Host "✅ [OK] Successfully bound $Description ($Port $Proto) -> $activeIp ($mode, Lease: ${LeaseTime}s)" -ForegroundColor Green
        $bound = $true
    } elseif ($output -match "718") {
        Write-Host "⚠️ [WAIT] Port $Port held by previous adapter lease. Waiting 15s (Attempt $attempt/$maxRetries)..." -ForegroundColor Yellow
        Start-Sleep -Seconds 15
    } else {
        Write-Host "❌ [ERROR] Binding output for $Description ($Port $Proto): $output" -ForegroundColor Red
        break
    }
}
