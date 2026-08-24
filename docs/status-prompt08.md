# Trell — Prompt 08 · Estado de implementación

> **Gestión de proyecto + onboarding + E2E live de auth.** Flujo de producto
> básico cerrado: Google → cuenta → proyecto → dominio → SDK → ingestion →
> analytics. `docs/sdk-contract.md` intacto. Handoff previo: `docs/status-prompt07.md`.

---

## 1. E2E live (real, 19/19 ✓) — `apps/web/scripts/e2e.ts` (`pnpm e2e`)
Corre contra **Postgres real** (contenedor Podman `trellpg` @ `localhost:5432`), el
**servidor Next** (build) y el **API Hono** con Prisma. El login de Google se
**simula** insertando una sesión de Auth.js en DB (el click-through de Google
requiere navegador real + dominio de callback configurado).

Verificado:
- unauthenticated `/api/projects` → **401**;
- sin sesión en `/dashboard` → **redirect /signin**;
- crear proyecto → **201 + pk + sk** (una vez);
- **sk nunca** en list, status, stats ni HTML del dashboard; `pk` es pública (SDK);
- ingestion origen permitido → **202**; origen no permitido → **403** (la allowlist
  se refleja al instante);
- relay stats refleja el evento ingerido (`submits=1`, `views=0` — correcto);
- installation status: **waiting → connected** (+ `lastEventAt`);
- allowlist: **add normaliza + dedup**, inválido → **400**;
- cross-user (no miembro) → **403**; su list no incluye el proyecto.

## 2. Qué se implementó

### Backend dashboard (`apps/web`)
- `GET /api/projects/[id]` → detalle **sin `sk`** + `installation { connected, lastEventAt }`
  (derivado de eventos; sin heartbeat).
- `PATCH /api/projects/[id]` → editar allowlist (addDomain/removeDomain), valida
  formato, normaliza (lowercase/quita `/`), deduplica.
- `src/lib/domains.ts` → validación/normalización de dominios (tests).
- La **allowlist** es la misma que lee la ingestion de la API (misma DB), así que el
  cambio se refleja inmediatamente.

### UI (`dashboard`, estilo Dub)
- **`CreateProjectModal`**: nombre + dominios → genera `pk`+`sk`; muestra la `sk`
  **una sola vez** con botón copiar y advertencia (se almacena solo el hash).
- **`ProjectSettings`**: **badge de instalación** ("Connected · Last event X ago" /
  "Waiting for first event"), **editor de dominios** (chips add/remove), **SDK
  snippet** con `pk`, y **onboarding** por pasos (Create → Add domain → Install SDK
  → Send first event → Verify → Dashboard) con checks según estado.
- Header: botones **New project** y **Settings**; empty state con CTA.

## 3. Estado
- `pnpm build` ✓ · `pnpm typecheck` ✓ · `pnpm test` → **94 tests** (50 API + 32 SDK
  + 12 web: authz 3, crypto 4, domains 5).
- **E2E: 19/19** (requiere Postgres; se corre con `pnpm e2e` y `DATABASE_URL`).
- Container Postgres `trellpg` levantado para desarrollo (no commiteado).

## 4. Requisitos runtime (documentado en `apps/web/.env`)
- **Postgres** (`DATABASE_URL`) — compartido por API y dashboard.
- **Google OAuth callback** de Auth.js: `http://localhost:3000/api/auth/callback/google`
  (dominio real en prod). Credenciales de `orbit.relake.co` ya en `apps/web/.env`.
- `AUTH_SECRET`, `TRELL_ENC_KEY` (cifrado de `sk`), `TRELL_API_URL`.

## 5. Qué falta / siguiente
- **Onboarding pulido** (asesor por pasos con verificación real).
- **Docker Compose self-host** (Next + Hono + Postgres) — el usuario lo pospuso:
  primero asegurar el flujo SaaS, luego empaquetar.
- Refinamiento Dub (kebab menus, toasts, tablas sortables).
- Migrar Prisma a `packages/db`; `docker-compose`; desviaciones del SDK (bundle,
  `form().destroy()`, `identify`).
- E2E con OAuth de Google **real** (browser/playwright) cuando haya dominio.

> **Decisiones:** allowlist reflejada de inmediato en ingestion; `lastEventAt`
> derivado de eventos (sin heartbeat); login Google simulado en el E2E headless;
> sin docker-compose todavía.
