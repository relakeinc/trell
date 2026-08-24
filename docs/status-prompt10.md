# Trell — Prompt 10 · Estado de implementación

> **Self-host reproducible (Docker Compose).** La frontera queda congelada:
> `@trell/sdk` (estable) → `apps/api` → `Postgres` ← `apps/web`.
> `docs/sdk-contract.md` intacto. Handoff: `status-prompt09.md`.

---

## 1. Qué se entregó

### `docker-compose.yml` (raíz — `docker compose up -d --build`)
- Servicios: **`db`** (postgres:17-alpine + volume `pg_data` + healthcheck `pg_isready`),
  **`migrate`** (one-shot, aplica schema), **`api`** (ingestion+analytics, :8787),
  **`web`** (dashboard+Auth.js, :3000).
- **Migración separada**: `migrate` corre `prisma db push` y sale; `api`/`web`
  esperan `service_completed_successfully` / `service_healthy`.
- **Healthchecks** (node `fetch`) en api `/health` y web `/signin`.
- **Dependencias** entre servicios + **red interna** (web→`http://api:8787`).
- Puertos publicados: `web:3000`, `api:8787`, `db:5432` (opcional debug).
- Secrets desde un `.env` raíz (`.env.example`).

### Dockerfiles (multi-stage, contexto = raíz del monorepo)
- `apps/api/Dockerfile`: builder (pnpm install → `@trell/shared build` → `prisma
  generate` → `tsc build`) + runner.
- `apps/web/Dockerfile`: builder (pnpm install → `@trell/shared build` →
  **`prisma generate`** → `next build`) + runner.
- `.dockerignore` (excluye node_modules, dist, .next, .env, .git, docs).

### Configuración / docs
- `.env.example`: **todas** las vars (Postgres, `DATABASE_URL`, `PUBLIC_URL`,
  `TRELL_ADMIN_KEY`, `TRELL_PK/SK_PREFIX`, `AUTH_SECRET`, Google OAuth,
  `TRELL_ENC_KEY`, rate limit).
- `docs/selfhost.md`: pasos, Google OAuth callback `PUBLIC_URL/api/auth/callback/google`,
  migraciones (db push / `migrate deploy`), puertos/red, smoke.
- `scripts/selfhost-smoke.sh`: flujo completo headless.

### SaaS vs self-host
El código es **el mismo** (`apps/api`, `apps/web`). No hay build ni producto
separado: en SaaS cambia solo la infra (Postgres/Google gestionados); self-host
aportas tu Postgres + OAuth + secretos. Documentado en `docs/selfhost.md`.

---

## 2. Validación
- **`podman build` imagen `apps/api` → OK** (pnpm install + prisma generate + tsc + runner).
- **`apps/web`**: autorado correctamente (fix: añadido `prisma generate` al builder —
  era el fallo real). El build completo **no finalizó aquí por límite de disco del
  sandbox** (97% lleno), no por error de código.
- **Smoke self-host (api path) → PASS** contra **Postgres real**:
  `create project (admin → pk/sk)` → `ingest (202, inserted=1)` →
  `analytics (submits=1)` → `disallowed origin (403)`.
- El **flujo completo** (auth por sesión + dashboard + relay + ingestion + analytics)
  ya quedó validado 19/19 en Prompt 08; aquí validado el path de bootstrap admin.
- **Regresión: 102 tests verdes** (SDK 40 · API 50 · web 12).

---

## 3. Cómo usarlo (en una máquina con Docker)
```bash
cp .env.example .env && $EDITOR .env   # AUTH_SECRET, TRELL_ENC_KEY, TRELL_ADMIN_KEY,
                                       # AUTH_GOOGLE_ID/SECRET, PUBLIC_URL, DATABASE_URL
docker compose up -d --build
docker compose ps                      # db/migrate/api/web
./scripts/selfhost-smoke.sh            # flujo headless completo
```
> En el sandbox no hay Docker (solo Podman) → no se pudo ejecutar
> `docker compose up` aquí; la composición + imágenes están listas para tu máquina.

## 4. Fuera de alcance (por diseño, ver roadmap)
billing · equipos/RBAC avanzado · integraciones (Slack/Jira/Notion) · alertas ·
webhooks · rollups · Kubernetes · Terraform · CI/CD complejo · observabilidad empresarial.

---

## 5. Resumen del producto hasta aquí
SDK estable (`@trell/sdk`, 0 deps, contrato congelado) + ingestion (Hono, pk) +
analytics (sk, server-side) + dashboard (Next.js + Auth.js, sesión en DB) +
onboarding + allowlist + instalación self-host reproducible.
