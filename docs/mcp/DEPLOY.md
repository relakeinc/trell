# Trell MCP — Deploy

## Production

- Standalone stack in `<APP_DIR>` (branch `main`), sharing the Postgres
  network of the main stack (which is left untouched).
- Service `mcp`: image from the `apps/api` Dockerfile with `MCP_ONLY=1`
  (MCP only, no Hono), published on `127.0.0.1:8788`.
- `.env` (mode 600): `DATABASE_URL` (shared DB), `MCP_ONLY=1`,
  `MCP_HTTP_PORT=8788`, `MCP_API_KEY` (generate with
  `openssl rand -hex 32`), `MCP_ALLOWED_SLUGS=*`,
  `MCP_ALLOW_DESTRUCTIVE=false`.
- Reverse proxy `mcp.example.com` → `127.0.0.1:8788` (nginx site file,
  long timeouts ~300s for streaming responses).
- TLS: expand your existing cert to cover the MCP subdomain, e.g.
  `certbot --expand -d app.example.com -d api.example.com -d mcp.example.com`
  (requires the `A mcp.example.com` record pointing at your server).
  Note: if the domain sits behind a CDN proxy, the public smoke test
  passes the same way.

Update:

```bash
cd <APP_DIR> && git pull && docker compose up -d --build mcp
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8788/  # 405 = alive
```

Checklist pre-deploy (lesson learned: a filter once went out uncommitted):

1. `git status --short -- apps/mcp apps/api` shows no pending changes.
2. Post-deploy: identity probe (tokens for 2 emails → only their slugs).

Sin Bearer → `401` + `WWW-Authenticate` (discovery OAuth, RFC 9728).

## Detalles que morderían si se olvidan

- El Dockerfile compila `@trell/mcp` antes que la API (el `dist` no viaja en
  el contexto por `.dockerignore`).
- El listener bindea `0.0.0.0` dentro del contenedor (docker-proxy entra por
  la IP del contenedor; con `127.0.0.1` la conexión se resetea). El mapping
  `127.0.0.1:8788` ya restringe el host.
- Un transport HTTP del SDK por request (reutilizarlo falla en la 2ª petición).
- `pnpm-lock.yaml` debe incluir las deps de `apps/mcp` o el build Docker
  (`--frozen-lockfile`) falla.

## Local

- VS Code: `.vscode/mcp.json` (stdio, `apps/api/dist/mcp-stdio.js`;
  requiere `pnpm --filter @trell/api build`). El runner autocarga
  `apps/api/.env`.
- Demo sin DB: `MCP_DEMO=1` (datos efímeros en memoria).
