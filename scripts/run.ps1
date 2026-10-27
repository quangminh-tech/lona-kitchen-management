$ErrorActionPreference = 'Stop'
Set-Location "$PSScriptRoot/.."
if (!(Get-Command node -ErrorAction SilentlyContinue)) { throw 'Can cai Node.js' }
if (!(Get-Command dotnet -ErrorAction SilentlyContinue)) { throw 'Can cai .NET SDK 10' }
if (!(Test-Path backend/AppData/identity.json) -and !$env:LONA_ADMIN_PASSWORD) {
    $secret = Read-Host 'Dat mat khau admin (toi thieu 12 ky tu)' -AsSecureString
    $env:LONA_ADMIN_PASSWORD = [System.Net.NetworkCredential]::new('', $secret).Password
    if ($env:LONA_ADMIN_PASSWORD.Length -lt 12) { throw 'Mat khau qua ngan' }
}
npm --prefix frontend ci
if ($LASTEXITCODE) { throw 'npm ci failed' }
npm --prefix frontend run build
if ($LASTEXITCODE) { throw 'build failed' }
New-Item -ItemType Directory -Force backend/wwwroot | Out-Null
Copy-Item frontend/dist/* backend/wwwroot -Recurse -Force
Write-Host 'Mo http://localhost:5080 — ten dang nhap admin'
try { dotnet run --project backend/Lona.Week.Api.csproj --urls http://localhost:5080 }
finally { Remove-Item Env:LONA_ADMIN_PASSWORD -ErrorAction SilentlyContinue }
