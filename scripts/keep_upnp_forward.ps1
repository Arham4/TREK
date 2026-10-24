$UpnpExe = "C:\tools\upnpc.exe"
$LeaseTime = 1200
$Port = 3001
$Proto = "TCP"
$Description = "TREK"

# Find active LAN IP (Ethernet preferred, Wi-Fi fallback)
$ethIp = (Get-NetIPAddress -InterfaceAlias 'Ethernet*' -AddressFamily IPv4 -ErrorAction SilentlyContinue |
          Where-Object { $_.IPAddress -like "192.168.1.*" -and $_.IPAddress -notlike "169.254.*" }).IPAddress | Select-Object -First 1

if ($ethIp) {
    $activeIp = $ethIp
} else {
    $activeIp = (Get-NetIPAddress -InterfaceAlias 'Wi-Fi*' -AddressFamily IPv4 -ErrorAction SilentlyContinue |
                 Where-Object { $_.IPAddress -like "192.168.1.*" -and $_.IPAddress -notlike "169.254.*" }).IPAddress | Select-Object -First 1
}

if (-not $activeIp) {
    Write-Host "No active 192.168.1.* LAN IP found." -ForegroundColor Red
    exit 1
}

# Bind UPnP port forwarding for TREK
$output = (& $UpnpExe -m $activeIp -e $Description -a $activeIp $Port $Port $Proto $LeaseTime 2>&1 | Out-String)

if ($output -match "is redirected to internal $activeIp") {
    Write-Host "✅ [OK] Successfully forwarded $Description ($Port $Proto) -> $activeIp (Lease: ${LeaseTime}s)" -ForegroundColor Green
} else {
    Write-Host "⚠️ UPnP Output: $output" -ForegroundColor Yellow
}
