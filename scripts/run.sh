#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
command -v node >/dev/null || { echo 'Can cai Node.js truoc.'; exit 1; }
command -v dotnet >/dev/null || { echo 'Can cai .NET SDK 10 truoc.'; exit 1; }
if [[ ! -f backend/AppData/identity.json && -z "${LONA_ADMIN_PASSWORD:-}" ]]; then
  read -r -s -p 'Dat mat khau admin (toi thieu 12 ky tu): ' LONA_ADMIN_PASSWORD
  echo
  [[ ${#LONA_ADMIN_PASSWORD} -ge 12 ]] || { echo 'Mat khau qua ngan.'; exit 1; }
  export LONA_ADMIN_PASSWORD
fi
npm --prefix frontend ci
npm --prefix frontend run build
mkdir -p backend/wwwroot
cp -R frontend/dist/. backend/wwwroot/
echo 'Mo http://localhost:5080 — ten dang nhap admin'
dotnet run --project backend/Lona.Week.Api.csproj --urls http://localhost:5080
