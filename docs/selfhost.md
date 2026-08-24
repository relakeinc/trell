# Trell — Self-hosting

Trell se puede levantar completa con Docker Compose:

```
docker compose up -d --build
```

Eso arranca tres servicios + un paso de migración:

```
┌─ Web / Dashboard (Next.js) ──── :3000
├─ API / Ingestion (Hono) ─────── :8787
└─ PostgreSQL ─────────────────── :5432 (volumen pg_data)
```

> **SaaS vs self-host: el código es el mismo.** No existe una "versión self-host"
> de Trell. En SaaS corren los mismos `apps/api` y `apps/web` (con Postgres/Google
> gestionados); al self-hostear aportas tu propia infraestructura (Postgres, OAuth de
> Google, secretos, URLs). No se mezclan builds ni imágenes distintas.

---

## 1. Requisitos
- Docker Engine + Docker Compose (v2).
- Un dominio/no-código para el dashboard (`PUBLIC_URL`).

## 2. Pasos

```bash
# 1) clonar y entrar
git clone <repo> trell && cd trell

# 2) configuración (obligatorio)
cp .env.example .env
$EDITOR .env
```

Vars imprescindibles en `.env`:

| Variable | Para qué | Notas |
|----------|----------|-------|
| `AUTH_SECRET` | Firmar sesiones de Auth.js | `openssl rand -base64 32` |
| `TRELL_ENC_KEY` | Cifrar la `sk` de cada proyecto | `openssl rand -hex 32` — **no cambiar** tras crear proyectos |
| `TRELL_ADMIN_KEY` | Crear proyectos vía `POST /v1/projects` | guardar en secreto |
| `DATABASE_URL` | Postgres | apunta al servicio `db` (ver abajo) |
| `POSTGRES_PASSWORD` | Password del contenedor `db` | cambia `DATABASE_URL` en consecuencia |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | Google Sign-In | ver §3 |
| `PUBLIC_URL` | URL pública del dashboard | p.ej. `https://trell.midominio.com` |

`DATABASE_URL` por defecto: `postgresql://trell:<POSTGRES_PASSWORD>@db:5432/trell`.
> Si usas un Postgres externo (SaaS/managed), ponlo aquí y quita la dependencia
> del servicio `db`.

```bash
# 3) levantar
docker compose up -d --build

# 4) ver estado / logs
docker compose ps
docker compose logs -f api web

# 5) smoke (opcional)
./scripts/selfhost-smoke.sh
```

## 3. Google OAuth
1. En Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client.
2. Authorized redirect URI: **`<PUBLIC_URL>/api/auth/callback/google`**.
3. Copia `Client ID` / `Client Secret` a `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET`.
4. `docker compose restart web`.

> El flujo de auth es Auth.js (sesiones en DB). La pestaña de Google es la única
> puerta de entrada al dashboard en esta versión.

## 4. Crear un proyecto y usar el SDK
**Opción A (dashboard):** entra a `PUBLIC_URL`, sign in, "New project". Verás `pk`
y `sk` **una sola vez** (la `sk` solo se guarda cifrada). Añade el dominio y copia
el snippet del SDK.

**Opción B (API):**
```bash
# bootstrap (dev) → devuelve pk + sk una vez
curl -X POST http://localhost:8787/v1/projects \
  -H "authorization: Bearer $TRELL_ADMIN_KEY" -H 'content-type: application/json' \
  -d '{"name":"Mi Sitio","domains":["example.com"]}'
```

**Instala el SDK** en tu sitio (ver `docs/sdk-contract.md`):
```html
<script defer src="https://cdn.../sdk.js" data-project="pk_..." data-domain="example.com"></script>
```

**Ingesta** (pública, `pk`): `POST /v1/events` (batch). **Analytics** (privada,
`sk`): `GET /v1/projects/:id/{stats|series|breakdown|forms|events}`. El dashboard
nunca expone la `sk` al navegador.

## 5. Migraciones
El servicio `migrate` aplica el schema con `prisma db push` al arrancar (idempotente)
y `api`/`web` esperan a que termine. Para entornos de producción con control de
versiones del schema, sustituye por migraciones reales:

```bash
cd apps/api
npx prisma migrate dev --name baseline     # genera prisma/migrations
# en docker-compose.yml, cambia el command de `migrate` a:
#   sh -c "cd apps/api && pnpm exec prisma migrate deploy"
```

## 6. Puertos y red
- `web:3000` público (dashboard). Interno habla con la API en `http://api:8787` (`TRELL_API_URL`).
- `api:8787` público (ingestión del SDK). 
- `db:5432` interno (opcional publicarlo para debug).
- Volumen `pg_data` persiste Postgres.

## 7. Smoke
`./scripts/selfhost-smoke.sh` valida el flujo completo headless:
`healthy → api /health → proyecto(pk/sk) → ingestión → evento en Postgres (analytics) → web responde`.

## 8. Notas / límites de esta versión
- No incluye billing, equipos/RBAC avazados, webhooks, integraciones ni rollups
  (por diseño; ver roadmap).
- El log de la API en memoria solo se usa si no hay `DATABASE_URL`; en self-host
  siempre hay Postgres.
- Para replicar el flujo completo con login, usa un navegador y el OAuth de Google
  (§3); el smoke headless simula la sesión en DB.
