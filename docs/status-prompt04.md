# Trell — Prompt 04 · Estado de implementación

> **SDK → API → validación → auth → Postgres.** End-to-end sólido (con repo en
> memoria en los tests; Postgres/Prisma implementado y listo).
> No se tocó `docs/sdk-contract.md`. Handoff: `docs/status-prompt03.md`.

---

## 1. Qué se implementó en `apps/api` (Hono, TypeScript)

### Rutas
- `POST /v1/ingest` y `POST /v1/events` (**alias**) → ingestion de eventos.
  - Se mantiene `/v1/events` porque es el endpoint por defecto del SDK (contract
    §13) y `/v1/ingest` como ruta canónica que pediste; ambas apuntan al mismo
    handler.
- `POST /v1/projects` → **bootstrap** de proyecto (requiere `TRELL_ADMIN_KEY`).
  Crea organiación+proyecto y devuelve `pk` + `sk` **una sola vez**.
- `GET /health` → `{ ok: true }`.

### Middleware (orden correcto)
1. **Size limit** — `content-length`/serializado > `maxBodyBytes` (256 KB) → 413.
2. **Auth por `pk`** (`Authorization: Bearer pk_...`) → resuelve proyecto; valida
   **Origin/Referer** contra la allowlist de dominios; adjunta `project`.
   - `pk` = publishable (viaja al navegador). `sk` se usa solo en el dashboard/
     management (no implementado aún) y **nunca** llega al SDK.
3. **Rate limit** — ventana fija in-memory por `project+ip`; devuelve `429` con
   `Retry-After`. Se evalúa antes de procesar la carga.
4. **Validación zod autoritativa** (`@trell/shared/schemas`) — **no confía** en el
   SDK; rechaza `400 invalid_event` si falta algo (p.ej. `project`).
5. **Idempotencia** por `event_id` (unique + `skipDuplicates`) → `inserted`/`duplicates`.

### Repositorios
- `Repo` (interfaz) + **`MemoryRepo`** (tests/demo, herméticos) + **`PrismaRepo`**
  (Postgres, producción).
- `index.ts` elige repo según que exista `DATABASE_URL` (Postgres) o no (memoria).

### Esquema Prisma (`apps/api/prisma/schema.prisma`, Postgres)
- **Organization**, **Project** (`publishableKey` único, `apiKeyHash` = sha256 de
  `sk`, `domains` byte string de allowlist), **Event** (índices `(projectId, ts)`
  y `(projectId, type, ts)`, `eventId` único, `ts`/`receivedAt`, propiedades/raw
  persistidas). Timestamps e índices desde el arranque.

### Seguridad
- Separación `pk`/`sk`; **solo se almacena el hash** de `sk`; `sk` se muestra una
  vez al crear el proyecto (`scripts/seed.ts` + endpoint bootstrap).
- Validación de dominio/origen (allowlist con `*.domain`).
- Límites de tamaño de batch/payload (413) y rate limit (429).
- La integración valida el schema con zod sin confiar en el cliente.

---

## 2. Estado de build / tests
- `pnpm build` ✓ · `pnpm typecheck` ✓ (strict, 5 tareas verdes).
- `pnpm test` ✓ — **57 tests**:
  - `apps/api` **25**: validación (6), rate limit (4), auth/ingestion/errores (10),
    integración **SDK→API** en jsdom (5: batch, dedupe, origin 403, 429, CORS).
  - `apps/sdk` **32** (de Prompt 03, siguen verdes).
- **Smoke e2e real por HTTP verificado** (curl): `202 inserted:1` → dedupe
  `inserted:0 duplicates:1` → `403` origen no permitido → `401` key inválida →
  `400` si falta `project` (la validación autoritativa funciona).

---

## 3. Qué falta (fuera del alcance de Prompt 04)
- **Dashboard / analytics UI** (leer métricas/rollups) — Prompt 05.
- **API de management con `sk`** (CRUD de projects/forms, stats/queries).
- **Rollups / agregaciones** y queries del dashboard.
- **Redis** para rate limit a escala (MVP: in-memory, advertencia en logs).
- **ClickHouse/Tinybird** cuando el volumen lo exija.
- **`docker-compose`** de self-host (api + Postgres) — pendiente.
- **`packages/db`** (Prisma viven en `apps/api` por simplicidad; migrar a paquete
  compartido cuando se agregue el dashboard).
- Las 3 desviaciones del SDK (bundle ~5.8KB, `form().destroy()`, semántica de
  `identify`) siguen abiertas — ninguna bloquea la ingestion.

---

## 4. Notas / decisiones tomadas
1. **Endpoint alias** (`/v1/events` + `/v1/ingest`): se mantuvo el default del
   contrato para no romper el SDK y se añadió `/v1/ingest` como canónico. Si
   quieres unificar, es un cambio de una línea en `@trell/shared` §13 + `index.ts`.
2. **Prisma en `apps/api`**: para mantener el Prompt enfocado; se migra a
   `packages/db` cuando exista el dashboard.
3. **Tests sin DB**: los automatizados usan `MemoryRepo` (herméticos). El camino
   Postgres/Prisma está implementado y typechecked, pero requiere una instancia
   Postgres para smoke manual (`docker-compose`/Podman) o un `DATABASE_URL`.
4. **`createMany(... skipDuplicates)`** da idempotencia; `res.count` = insertados.
5. Rate limit: ventana fija in-memory; se alerta en console que para multi-instancia
   se necesita Redis.

---

## 5. Cómo probar end-to-end (manual, sin DB)
```bash
TRELL_ADMIN_KEY=devadmin PORT=8787 pnpm --filter @trell/api db:generate  # una vez
pnpm --filter @trell/api dev
# 1) crear proyecto → pk/sk (una sola vez)
curl -X POST localhost:8787/v1/projects -H 'authorization: Bearer devadmin' -H 'content-type: application/json' \
  -d '{"name":"Mi Sitio","domains":["example.com"]}'
# 2) enviar un evento (el SDK/envuelve esto automáticamente)
curl -X POST localhost:8787/v1/events -H 'authorization: Bearer <pk>' -H 'origin: https://example.com' \
  -H 'content-type: application/json' -d '[{...envelope del SDK...}]'
```
