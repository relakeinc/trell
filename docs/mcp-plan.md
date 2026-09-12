# MCP de Trell — Plan técnico

> Estado: **FASE 1 IMPLEMENTADA** (2026-09-09). Fases 2-5 pendientes.
> Objetivo: servidor MCP que exponga Trell (lectura y acciones) para conectarlo
> después a un bot. Transporte dual, multi-workspace, desplegado junto a `apps/api`.

## 1. Decisiones tomadas

| #   | Decisión      | Valor elegido                                                                               | Por qué                                                                |
| --- | ------------- | ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| 1   | Transporte    | **Ambos**: `stdio` (dev: Claude Desktop/Cursor) + **Streamable HTTP** (bot)                 | stdio para desarrollar, HTTP para producción                           |
| 2   | Workspaces    | **Multi-workspace**: las tools reciben `project` (slug o id)                                | Un solo MCP sirve todos los proyectos; el control de acceso va por env |
| 3   | Alcance       | **Lectura + acciones** (escrituras seguras en v1; destructivas tras bandera + confirmación) | Útil desde el día 1 sin riesgo de borrar nada por accidente            |
| 4   | Despliegue    | **Mismo servidor/proceso que `apps/api`** (montado en la app Hono)                          | Un solo deploy, comparte Prisma, config y red                          |
| 5   | Documentación | Este plan + docs de operación al implementar                                                | Rastro completo de qué se hizo y cómo                                  |

## 2. Arquitectura

```
Bot (futuro) ──HTTPS──▶ apps/api (Hono, mismo proceso)
                          ├─ /v1/*        (API existente, sin cambios)
                          └─ /mcp         (Streamable HTTP, NUEVO, Bearer MCP_API_KEY)
Claude Desktop ─stdio──▶ apps/mcp/src/stdio.ts (NUEVO, dev local)
                          │
                          ▼
                 apps/mcp/src/tools/* ──▶ Prisma (misma DB) / Repo pattern
```

- **Paquete nuevo `apps/mcp/`**: definiciones de tools, resources y prompts + entry
  `stdio.ts`. NO duplica acceso a datos: importa el `Repo`/`PrismaRepo` de
  `apps/api` (o un `packages/db` si se extrae después).
- **HTTP montado en `apps/api`**: `app.route("/mcp", mcpHttpApp)` con middleware
  Bearer (`MCP_API_KEY`, `timingSafeEqual`). Comparte `deps.prisma`.
- **SDK**: `@modelcontextprotocol/sdk` oficial (TypeScript), `McpServer` +
  `StdioServerTransport` / `StreamableHTTPServerTransport`.
- **Auth por workspace**: el MCP es single-tenant (el dueño). Acceso acotado con
  `MCP_ALLOWED_SLUGS` (ej. `*` o `mi-tienda,otro`). Cada tool recibe `project`
  (slug o id) y resuelve contra la DB; si el slug no está permitido → error.

## 3. Catálogo de tools (v1)

Convención: `project: string` (slug o id) en todas. Paginación con tope
(`limit` máx. 100, defecto 25). Fechas ISO. Errores `{ code, message }`.

### Lectura

| Tool                          | Qué hace                                                            | Origen                         |
| ----------------------------- | ------------------------------------------------------------------- | ------------------------------ |
| `list_projects`               | workspaces accesibles (id, slug, name, plan)                        | `ProjectUser`                  |
| `get_project`                 | detalle + instalación (`connected`, `lastEventAt`) + uso vs límites | `getProjectOwnerPlan`, `Event` |
| `get_stats`                   | KPIs agregados (rango, filtros)                                     | `routes/analytics`             |
| `get_series`                  | serie temporal                                                      | `routes/analytics`             |
| `get_breakdown`               | desglose por dimensión                                              | `routes/analytics`             |
| `get_forms`                   | ranking de formularios                                              | `routes/analytics`             |
| `query_events`                | eventos recientes (tope 100)                                        | `getEventsForAnalytics`        |
| `get_funnel` / `list_funnels` | funnels + pasos                                                     | `Funnel`                       |
| `list_views`                  | vistas guardadas                                                    | `SavedView`                    |
| `list_webhooks`               | webhooks (URL, eventos, enabled; **nunca el secret**)               | `Webhook`                      |
| `list_utm_templates`          | plantillas UTM                                                      | `UtmTemplate`                  |
| `list_api_keys`               | keys **metadata solo** (nombre, prefijo, fecha; jamás hashes)       | `ApiKey`                       |
| `get_domains`                 | allowlist actual + aviso si vacía                                   | `Project.domains`              |
| `tracking_checkup`            | ¿está llegando data? (último evento, dominios, pk)                  | combinado                      |

### Escritura (segura)

| Tool                                          | Qué hace                                               | Guardarraíl                         |
| --------------------------------------------- | ------------------------------------------------------ | ----------------------------------- |
| `create_funnel` / `update_funnel`             | CRUD funnels                                           | valida pasos como el dashboard      |
| `create_utm_template` / `update_utm_template` | CRUD plantillas                                        | nombre obligatorio                  |
| `add_domain` / `remove_domain`                | allowlist                                              | `sanitizeDomains` + límite del plan |
| `create_webhook`                              | alta webhook                                           | URL válida + solo plan Pro          |
| `create_api_key`                              | **devuelve el secreto UNA vez** con advertencia `.env` | nombre obligatorio                  |
| `delete_webhook`                              | baja webhook                                           | tras bandera destructiva (ver §4)   |

### Destructivas (tras bandera, ver §4)

`revoke_api_key`, `delete_utm_template`, `delete_project`, `rotate_secret`.

### Resources y prompts

- `trell://projects` (lista), `trell://projects/{slug}/usage` (uso vs límites),
  `trell://schema/events` (formato de evento válido para server-side).
- Prompts: `weekly_report` (resumen de conversión), `tracking_setup_help`.

## 4. Seguridad (no negociable)

1. **HTTP siempre con Bearer** (`MCP_API_KEY` ≥ 32 chars, `timingSafeEqual`); sin
   key → 401. Solo HTTPS en producción (el bot y el server en la misma red
   privada si es posible).
2. **Secretos**: jamás se loguean ni se listan. `create_api_key` retorna el
   secreto una vez con texto de advertencia. Los deletes por hash usan
   `deleteMany({ id, projectId })` (acotado, como ya se hace en web).
3. **Destructivas**: flag `MCP_ALLOW_DESTRUCTIVE=false` por defecto + argumento
   `confirm: true` obligatorio en la llamada. Sin ambos → error.
4. **Topes**: `limit` máx. 100, rangos de fecha máx. 366 días, batch ingest como
   el existente. Las llamadas MCP no pasan por el rate-limiter HTTP → añadir
   límite simple por sesión si se expone público (v2).
5. **sk del bot**: el bot guarda **una named key** (`sk_…` de API Keys) en su
   `.env`, nunca la pk sola para acciones. Esa key solo sirve para los
   workspaces permitidos.

## 5. Variables de entorno (nuevas)

| Var                     | Uso                               | Ejemplo                 |
| ----------------------- | --------------------------------- | ----------------------- |
| `MCP_API_KEY`           | Bearer del endpoint `/mcp` (HTTP) | `opcional-en-dev-stdio` |
| `MCP_ALLOWED_SLUGS`     | slugs permitidos, `*` = todos     | `*`                     |
| `MCP_ALLOW_DESTRUCTIVE` | habilita tools destructivas       | `false`                 |
| `TRELL_SECRET_KEY`      | (lado **bot**, no MCP) sk del bot | `sk_…`                  |

## 6. Fases de implementación

- **Fase 1 — esqueleto**: ✅ HECHA (2026-09-09). `apps/mcp/` (package, tsconfig,
  vitest, tsup), 4 tools de lectura (`list_projects`, `get_project`,
  `get_stats`, `tracking_checkup`), entry stdio (`src/stdio.ts`, `MCP_DEMO=1` o
  `DATABASE_URL`), 11 tests en verde + smoke test stdio real verificado.
  Deps: `@modelcontextprotocol/sdk@1.30.0`, `zod@3`, `@trell/api` (repos),
  `@prisma/client` (reutiliza el cliente ya generado; NO correr
  `prisma generate` en `apps/mcp` — el engine DLL lo bloquea el api en dev).
- **Fase 2 — lectura completa**: ✅ HECHA Y DESPLEGADA (2026-09-09). 14 tools (`get_series`, `get_breakdown`, `get_forms`,
  `query_events`, `list/get_funnel`, `list_views`, `list_webhooks`,
  `list_utm_templates`, `list_api_keys` + las 4 de Fase 1), 3 resources
  (`trell://projects`, `trell://projects/{slug}/usage`,
  `trell://schema/events`), 2 prompts (`weekly_report`, `tracking_setup_help`).
  Docs: `docs/mcp/TOOLS.md`, `AUTH.md`, `DEPLOY.md`. Tests MCP 22/22.
  Detalle: intervalo `hour|day|week`, 9 dimensiones, `conversionRate` =
  successes/starts (dashboard), cursor `eventId` determinista (sort interno),
  secretos/hashes jamás expuestos. `McpStore` usa los nombres del Repo
  (`listSavedViews`) para compatibilidad estructural.
- **OAuth + identidad por usuario**: ✅ DESPLEGADO (2026-09-10). DCR
  (`POST /register`), `GET /authorize` → Google (mismo cliente que el
  dashboard), `/oauth/callback`, `/token` (PKCE S256 + refresh), metadata RFC
  9728, JWT HS256 stateless (codes 10min, access 12h, refresh 30d). Bearer =
  service key (modo servicio) o access token (identidad → membresías reales;
  `list_projects` solo devuelve tus workspaces). Tests MCP 42/42. Vars en
  el `.env` del stack MCP: `GOOGLE_CLIENT_ID/SECRET` (los mismos del
  dashboard), `MCP_OAUTH_SECRET`, `MCP_PUBLIC_URL`, `MCP_ALLOWED_EMAILS` opcional.
- **Fase 3 — escrituras**: ✅ HECHA Y DESPLEGADA (2026-09-10). 28 tools:
  funnels CRUD, UTM CRUD, add/remove domain (normalizados), webhooks
  create/delete (URL validada), `create_api_key` (secreto una vez),
  destructivas `revoke_api_key`/`delete_project`/`rotate_project_secret`
  (owner + `MCP_ALLOW_DESTRUCTIVE` + `confirm`). Smoke en prod con cleanup
  (create→delete→verificado, 0 restos). Docs en `docs/mcp/TOOLS.md`.
- Lección VS Code: edita `settings.json` con él cerrado (si no, pisa cambios
  externos al guardar). Por eso la config vive en `.vscode/mcp.json` (solo se
  reescribe al añadir/quitar servidores) y sin secretos: OAuth por discovery.
- **Fase 3 — escritura**: tools de escritura + bandera destructiva + tests de
  acotado por proyecto (una key/slug no toca otro).
- **Fase 4 — HTTP + deploy**: ✅ DESPLEGADO (2026-09-09) con una salvedad (TLS,
  ver abajo). Listener `createMcpHttpListener` (stateless, un transport por
  request — el transport compartido del SDK falla en la 2ª petición),
  Bearer `MCP_API_KEY` (fail-closed), `MCP_ONLY=1` para contenedor dedicado.
  Stack independiente `<APP_DIR>` en el servidor (misma DB vía la red del
  compose principal, sin tocar los contenedores en servicio): build OK, `GET→405`,
  sin-auth→401, `tracking_checkup` con datos reales OK.
  - Package graph acíclico: `apps/mcp` define `src/store.ts` (contrato
    mínimo) y NO depende de `@trell/api`; los runners (`src/mcp-stdio.ts`,
    listener en `src/index.ts`) viven en `apps/api` (dep `api → mcp`).
  - Ojo Docker: el listener bindea `0.0.0.0` dentro del contenedor
    (docker-proxy entra por la IP del contenedor; `127.0.0.1` = reset).
    El mapping `127.0.0.1:8788` ya restringe el acceso en el host.
  - Dockerfile compila `@trell/mcp` antes que la API (si no, `dist` ausente
    y el contenedor rompe al arrancar).
- **Fase 5 — bot**: con el MCP en producción, conectar el bot elegido.
  → Hecho como **webchat embebido** (2026-09-10, ver `docs/webchat.md`):
  widget "Ask Trell" en el dashboard, Gemini gratis, backend que firma JWT
  de identidad por sesión. Sin infra nueva.

## 7. Criterios de aceptación

- `pnpm --filter @trell/mcp typecheck` y `test` en verde.
- `typecheck`/`test` de `web`, `api`, `sdk` siguen en verde (sin regresiones).
- Suite MCP: lectura multi-proyecto, escritura válida/inválida, destructiva
  bloqueada sin flag y sin `confirm`, secreto visible una sola vez, 401 sin
  Bearer en `/mcp`.
- Docs actualizadas: este archivo pasa a "IMPLEMENTADO" con fecha + `docs/mcp/`
  (TOOLS, AUTH, DEPLOY).

## 8. Pendiente para el bot (no es este proyecto)

Elegir plataforma (Telegram/Discord/WhatsApp/webchat), identidad del bot,
formato de respuestas (idioma, resúmenes) y hosting. El MCP no cambia por esto.

## 9. Deploy (ejemplo con subdominio propio)

- Subdominio: **`mcp.example.com`**.
- Stack: `<APP_DIR>` (rama `main`), compose propio, `.env` 600 con
  `DATABASE_URL`, `MCP_ONLY=1`, `MCP_API_KEY` (generada con
  `openssl rand -hex 32`), `MCP_ALLOWED_SLUGS=*`,
  `MCP_ALLOW_DESTRUCTIVE=false`.
- nginx: `mcp.example.com` → `127.0.0.1:8788`. Actualizar:
  `cd <APP_DIR> && git pull && docker compose -f docker-compose.mcp.yml up -d --build mcp`.
- ✅ TLS: el `A mcp.example.com` debe resolver a tu servidor; cert
  expandido para cubrir el subdominio. Smoke público OK: sin-auth→401,
  `get_stats` con datos reales por `https://mcp.example.com`.
- Clave del bot: lee `MCP_API_KEY` de tu `.env` (nunca la commitees).
  Endpoint para el bot: `https://mcp.example.com` con
  `Authorization: Bearer`.

## 9. Notas de implementación (Fase 1)

- `apps/api` expone `./repositories` (barrel `MemoryRepo`, `PrismaRepo`, tipos)
  para reutilizar sin duplicar. Se añadió `findProjectBySlug` y
  `listProjects` al `Repo` (tipos + `PrismaRepo` + `MemoryRepo`).
- `apps/mcp/src`: `config.ts` (`MCP_ALLOWED_SLUGS`, `MCP_ALLOW_DESTRUCTIVE`,
  `MCP_API_KEY`), `errors.ts` (`McpError` + códigos), `projects.ts`
  (`resolveProject` por id/slug + allowlist, `requireDestructive`,
  `parseDomains`), `tools/{projects,stats,tracking}.ts`, `server.ts`
  (`createMcpServer`), `stdio.ts`, `index.ts` (exports para la Fase 4).
- `get_stats`: rango por defecto 30 días, máximo 366, valida `from <= to`.
- `tracking_checkup` hace un fetch completo de eventos (igual que las rutas de
  analytics); optimización futura: método `getLastEventTime` en el Repo.
- Uso local: `MCP_DEMO=1 pnpm --filter @trell/mcp dev` (stdio, datos
  efímeros) o con `DATABASE_URL` (Postgres real). Probar con cualquier
  cliente MCP apuntando al stdio.
- Prueba local configurada (2026-09-09): `.vscode/mcp.json` (servidor `trell`
  por stdio). El servidor autocarga `apps/mcp/.env` → `apps/api/.env` →
  `.env` (`src/env.ts`, sin pisar variables explícitas); la raíz se resuelve
  desde la ubicación del propio binario, así funciona con cualquier cwd del
  cliente. Verificado end-to-end contra Postgres real con cwd fuera del repo
  y sin `DATABASE_URL` en shell: `list_projects` (7 workspaces),
  `tracking_checkup` y `get_stats`. Arrancar el servidor desde la vista MCP.
- `resolveProject` busca por slug antes que por id: `findProjectById` con un
  string no-UUID hace que Prisma lance excepción en vez de devolver null.
