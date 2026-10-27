FROM node:22-bookworm-slim AS frontend
WORKDIR /src/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS backend
WORKDIR /src
COPY backend/Lona.Week.Api.csproj backend/
COPY samples/seed.json samples/seed.json
COPY samples/operations.json samples/operations.json
RUN dotnet restore backend/Lona.Week.Api.csproj
COPY backend/ backend/
RUN dotnet publish backend/Lona.Week.Api.csproj -c Release -o /publish --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app
COPY --from=backend /publish/ ./
COPY --from=frontend /src/frontend/dist/ ./wwwroot/
COPY scripts/docker-entrypoint.sh /usr/local/bin/lona-entrypoint
RUN chmod +x /usr/local/bin/lona-entrypoint
ENV ASPNETCORE_ENVIRONMENT=Production \
    DataPath=/var/data/state.json \
    IdentityPath=/var/data/identity.json \
    OperationsPath=/var/data/operations.json \
    DataProtectionPath=/var/data/keys
EXPOSE 10000
ENTRYPOINT ["/usr/local/bin/lona-entrypoint"]
