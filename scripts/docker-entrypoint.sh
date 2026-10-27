#!/bin/sh
set -eu
mkdir -p /var/data
exec dotnet Lona.Week.Api.dll --urls "http://0.0.0.0:${PORT:-10000}"
