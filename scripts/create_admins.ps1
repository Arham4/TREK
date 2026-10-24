# Interactive Admin Creation Script for TREK
# Run from repository root: .\scripts\create_admins.ps1

Write-Host "`n=========================================" -ForegroundColor Cyan
Write-Host "   TREK - Setup Two Admin Accounts       " -ForegroundColor Cyan
Write-Host "=========================================`n" -ForegroundColor Cyan

# --- User 1 ---
Write-Host "--- User 1 (Primary Admin) ---" -ForegroundColor Yellow
$u1_name = Read-Host "Username"
$u1_email = Read-Host "Email"
$u1_pass_sec = Read-Host -AsSecureString "Password (hidden)"
$u1_pass = [System.Net.NetworkCredential]::new("", $u1_pass_sec).Password

while ([string]::IsNullOrWhiteSpace($u1_name) -or [string]::IsNullOrWhiteSpace($u1_email) -or [string]::IsNullOrWhiteSpace($u1_pass)) {
    Write-Host "All fields are required for User 1. Please try again." -ForegroundColor Red
    $u1_name = Read-Host "Username"
    $u1_email = Read-Host "Email"
    $u1_pass_sec = Read-Host -AsSecureString "Password (hidden)"
    $u1_pass = [System.Net.NetworkCredential]::new("", $u1_pass_sec).Password
}

# --- User 2 ---
Write-Host "`n--- User 2 (Second Admin) ---" -ForegroundColor Yellow
$u2_name = Read-Host "Username"
$u2_email = Read-Host "Email"
$u2_pass_sec = Read-Host -AsSecureString "Password (hidden)"
$u2_pass = [System.Net.NetworkCredential]::new("", $u2_pass_sec).Password

while ([string]::IsNullOrWhiteSpace($u2_name) -or [string]::IsNullOrWhiteSpace($u2_email) -or [string]::IsNullOrWhiteSpace($u2_pass)) {
    Write-Host "All fields are required for User 2. Please try again." -ForegroundColor Red
    $u2_name = Read-Host "Username"
    $u2_email = Read-Host "Email"
    $u2_pass_sec = Read-Host -AsSecureString "Password (hidden)"
    $u2_pass = [System.Net.NetworkCredential]::new("", $u2_pass_sec).Password
}

Write-Host "`nWriting accounts to database..." -ForegroundColor Cyan

$dataDir = Join-Path (Get-Location) "data"
if (-not (Test-Path (Join-Path $dataDir "travel.db"))) {
    Write-Host "[ERROR] travel.db not found in $dataDir. Please execute this script from the TREK directory." -ForegroundColor Red
    exit 1
}

# Encode to base64 so passwords with quotes, backslashes, or dollar signs pass safely
$jsonBytes = [System.Text.Encoding]::UTF8.GetBytes((@{
    users = @(
        @{ username = $u1_name; email = $u1_email; password = $u1_pass },
        @{ username = $u2_name; email = $u2_email; password = $u2_pass }
    )
} | ConvertTo-Json -Compress))
$b64 = [Convert]::ToBase64String($jsonBytes)

$nodeScript = @"
const bcrypt = require('bcryptjs');
const Database = require('/app/server/node_modules/better-sqlite3');
const db = new Database('/data/travel.db');
const raw = Buffer.from(process.env.PAYLOAD_B64, 'base64').toString('utf8');
const input = JSON.parse(raw);

const insertStmt = db.prepare('INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)');
const updateStmt = db.prepare('UPDATE users SET username = ?, password_hash = ?, role = ? WHERE email = ?');
const findStmt = db.prepare('SELECT id FROM users WHERE email = ? OR username = ?');

for (const u of input.users) {
    const existing = findStmt.get(u.email, u.username);
    const hash = bcrypt.hashSync(u.password, 12);
    if (existing) {
        updateStmt.run(u.username, hash, 'admin', u.email);
        console.log('[OK] Updated account to admin: ' + u.username + ' (' + u.email + ')');
    } else {
        insertStmt.run(u.username, u.email, hash, 'admin');
        console.log('[OK] Created new admin: ' + u.username + ' (' + u.email + ')');
    }
}
"@

docker run --rm -e "PAYLOAD_B64=$b64" -v "${dataDir}:/data" mauriceboe/trek:latest node -e "$nodeScript"

# Ask to remove temporary admin account
Write-Host ""
$removeDefault = Read-Host "Would you like to remove the default temporary 'admin@trek.local' account? (Y/n)"
if ($removeDefault -eq '' -or $removeDefault -match '^(y|yes)$') {
    $cleanupScript = @"
const Database = require('/app/server/node_modules/better-sqlite3');
const db = new Database('/data/travel.db');
const res = db.prepare('DELETE FROM users WHERE email = ?').run('admin@trek.local');
if (res.changes > 0) {
    console.log('[OK] Removed default admin@trek.local account.');
}
"@
    docker run --rm -v "${dataDir}:/data" mauriceboe/trek:latest node -e "$cleanupScript"
}

Write-Host "`n✅ Setup complete! Both admin accounts are ready." -ForegroundColor Green
Write-Host "You can now log in at: https://trek.arhamjs.com/" -ForegroundColor Cyan
