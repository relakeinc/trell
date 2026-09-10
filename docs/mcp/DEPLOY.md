# Trell MCP — Deploy

## Producción (VPS)

- Stack independiente `/opt/trell-mcp` (rama `feat/mcp`), red `trell_default`,
  misma DB que el stack vivo (al que **no** se toca).
- Servicio `mcp`: imagen del Dockerfile de `apps/api`, `MCP_ONLY=1`
  (solo MCP, sin Hono), puerto `127.0.0.1:8788`.
- `.env` (600): `DATABASE_URL` (misma DB), `MCP_ONLY=1`, `MCP_HTTP_PORT=8788`,
  `MCP_API_KEY` (generada en el servidor), `MCP_ALLOWED_SLUGS=*`,
  `MCP_ALLOW_DESTRUCTIVE=false`.
- nginx `mcp.relake.co` → `127.0.0.1:8788` (fichero en
  `/etc/nginx/sites-{available,enabled}/`, timeouts 300s por streams largos).
- TLS: cert `trell.relake.co` expandido (`trell` + `trepi` + `mcp`).
  Renovar/expandir: `certbot --expand -d trell.relake.co -d trepi.relake.co -d mcp.relake.co`.
  Nota: el dominio va tras proxy Cloudflare — el smoke público pasa igual.
- TLS: expandir el cert existente
  `certbot --expand -d trell.relake.co -d trepi.relake.co -d mcp.relake.co`
  (requiere `A mcp.relake.co → 89.117.76.234`).

Actualizar:

```bash
cd /opt/trell-mcp && git pull && docker compose up -d --build mcp
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8788/  # 405 = vivo
```

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
