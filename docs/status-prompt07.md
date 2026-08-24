# Trell — Prompt 07 · Estado de implementación

> **Prompt 07: auth del dashboard.** Separado de la API pública; Next.js +
> Auth.js (sesión server-side); `sk` **nunca** en el browser. Design estilo Dub.
> `docs/sdk-contract.md` intacto. Handoff previo: `docs/status-prompt06.md`.

---

## 1. Arquitectura resultante

```
Browser → SDK (pk) → Hono ingestion → Postgres
Browser → Next.js Dashboard (Auth.js sesión) ─ server-side ─> (sk) → Hono analytics → Postgres
```

- **`pk`**: solo ingestion (pública). **`sk`**: solo servidor (never browser).
- El dashboard (Next.js) mantiene la sesión; el relé usa `sk` internamente.

## 2. Qué se implementó (`apps/web`, Next.js 15 + Auth.js v5)

### Auth
- **Auth.js v5** (`next-auth@beta`) con **Google OAuth** (credenciales de
  `orbit.relake.co` copiadas a `apps/web/.env`, valores no expuestos) y
  **sesiones en DB** (adapter Prisma).
- Páginas: `/` (landing / sign-in), `/signin`, `/dashboard` (protegida).
- Server actions `signInWithGoogle` / `signOutAction` (en `src/app/actions.ts`).
- `middleware`/guards: las rutas y el relé exigen sesión (`auth()` → 401/redirect).

### Modelo de datos (schema Prisma en `apps/api`)
- Añadidos **User, Account, Session, VerificationToken** (Auth.js adapter) y
  **ProjectUser** (membresía owner/member). `Project` gana `apiKeyEncrypted`.

### Secretos (nunca al browser)
- `sk` se genera al crear el proyecto, se muestra **una vez** en la UI y se guarda
  **cifrada en rest** (AES-256-GCM con `TRELL_ENC_KEY`, server-side). Solo se
  almacena el **hash** de `sk` para que la API verifique (como antes).
- El **relé server-side** descifra `sk` al vuelo y llama a la API de analytics
  (`TRELL_API_URL`). El browser solo ve JSON renderizado; nunca el `sk`.

### Relé de analytics (`/api/projects/[id]/[metric]`)
- `GET /api/projects/[id]/{stats|series|breakdown|forms|events}`:
  sesión → `canAccessProject` (authz) → descifra `sk` → llama a Hono → devuelve JSON.
- `GET/POST /api/projects`: listar accesibles / crear (owner = usuario).

### Autorización (tests sin DB)
- `ProjectAccessService` + `PrismaMembershipRepo` (prod) y `MemoryMembershipRepo`
  (tests). Sólo devuelve proyectos del usuario; aísla entre usuarios.

### UI (estilo Dub, `docs/design.md`)
- Sidebar (selector de proyecto, nav, footer de uso), header con título + acción
  oscura, **KPI cards**, **área chart** con gradiente, **funnel** de barras,
  **card con tabs** (Pages/UTM/Devices/Browser/OS), tabla de formularios,
  eventos recientes, **empty state** ("No projects yet" + CTA).
- **Filtros**: proyecto, rango de fechas (default 30d), intervalo (hora/día/semana).

### Limpieza
- Eliminado el dashboard dev que servía la **API Hono** (`GET /`) — ahora vive en
  Next.js. `pk` pública solo para ingestion; analytics permanece en `sk` server-side.

---

## 3. Estado
- `pnpm build` ✓ (incl. `next build`) · `pnpm typecheck` ✓ · `pnpm test` →
  **89 tests verdes** (50 API + 32 SDK + 7 web: authz 3, crypto 4).
- `apps/web/.env` creado con Google (orbit), `AUTH_SECRET`, `TRELL_ENC_KEY`,
  `TRELL_API_URL`, `DATABASE_URL` (gitignored).

## 4. Requisitos de runtime (para probar el flujo completo)
1. **Postgres** (`DATABASE_URL`) — el dashboard y la API comparten la misma DB.
   Para local: `docker-compose`/Podman con Postgres + `pnpm db:push`.
2. **Google OAuth callback** registrado en Google Cloud Console con la URL de
   callback de Auth.js: `http://localhost:3000/api/auth/callback/google`
   (en prod, el dominio real). Reutiliza `AUTH_GOOGLE_ID/SECRET` (de `orbit`).
3. `AUTH_URL` / `AUTH_SECRET` correctos.

## 5. Qué falta / siguiente
- **E2E live** del login Google + dashboard (requiere Postgres + callback real).
- Permitir editar la **allowlist de dominios** del proyecto desde la UI.
- Envolver el proyecto en una **organización/workspace** real (membresías ya
  preparadas), onboarding, y refinamiento del design Dub (kebab menus, toasts).
- (En `apps/api`) `docker-compose` self-host y migrar Prisma a `packages/db`.
- Desviaciones del SDK siguen abiertas (bundle, `form().destroy()`, `identify`).

> **Decisiones tomadas:** ambas métricas como estándar (`conversionRate` =
> successes/views, `startConversionRate` = successes/starts, presentadas como
> "Conversion rate" y "Completion after start"); `avgTimeToCompleteMs` desde
> `form_start` (sin cambios).
