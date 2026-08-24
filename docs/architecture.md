# Trell — Definición del producto

> **Bring analytics and conversion tracking to the forms you already have.**

Nombre de trabajo: **trell** (ajustable).
Estado: definición (Prompt 01) — sin escribir código todavía.

---

## 1. Resumen del producto

Infraestructura open source, API-first y SDK-first para **instrumentar y analizar
conversiones en formularios que el usuario ya construyó** con la tecnología y el
diseño que quiera.

No es un constructor de formularios, no es un Typeform/Tally, no es un Hotjar ni
un Dub. Es una capa de **observabilidad de conversiones** que se integra mediante
un SDK JavaScript universal, sin iframes y sin obligar a cambiar el formulario.

Filosofía (inspirada en herramientas developer-first):

- una sola funcionalidad hecha extremadamente bien;
- open source en el núcleo, SaaS administrado como opción futura;
- self-hostable;
- excelente DX y documentación;
- ligero y que no degrade el sitio del cliente.

---

## 2. Decisiones de alto nivel

| Área | Decisión | Por qué |
|------|----------|--------|
| Lenguaje API | **TypeScript + Hono** | TS compartido con SDK y dashboard; Hono rápido y portable a Node/edge para ingestion de alta frecuencia |
| Dashboard + Auth | **Next.js** (App Router) + **Auth.js (NextAuth)** | Es la referencia de "auth como Dub": sesiones en DB, magic link + OAuth |
| Base de datos | **PostgreSQL** vía **Prisma** | Migraciones, tipos, RLS multi-tenant; self-hostable con un binario. ClickHouse/Tinybird a futuro para eventos masivos |
| Auth de usuarios | **Magic link (email vía Resend) + OAuth GitHub/Google** | Auth.js con provider de credenciales/email + OAuth; sesiones guardadas en DB |
| Tenancy | **Proyectos con roles** (owner/member) | Modelo de workspace de Dub; `Project` es el tenant que agrupa forms |
| Auth SDK | Clave pública `pk_...` (solo enviar eventos) + clave secreta `sk_...` (gestión/dashboard) | Nunca exponer secretos en el navegador; restringir lo que la `pk` puede hacer. `sk_` guardada **hasheada** |
| Ingestion | `POST /v1/events` batch → `204`, key en header `Authorization: Bearer pk_...` | Menos round-trips y latencia; simple de firmar |
| Envío de eventos | `navigator.sendBeacon` para `pagehide`/abandono, `fetch keepalive` para interactivos | No perder eventos al cerrar/página |
| Identidad | `visitor_id` + `session_id` (UUID en cookie/LocalStorage de primera parte) + hash del email opcional (off) | Deduplicación, sesiones, sin PII por defecto. Cookieless mode (ver §8) |
| Framework | SDK universal vanilla TS; **sin wrappers** en el MVP | Cubre HTML/React/Vue/Next/Astro/Svelte/WP con una misma lib. Wrappers después |
| Monorepo | **Turborepo** | Mismo modelo que Dub: packages compartidos, single source of truth del schema |

**Decisiones confirmadas (Prompt 01):** auth completo estilo Dub · API en TypeScript+Hono ·
monorepo · nombre de trabajo **trell**.

**Decisiones confirmadas por ti que respeto:** MVP pequeño enfocado en tracking de
formularios; sin heatmaps/CTA/funnels/webhooks/integraciones en el MVP; separar
claramente lo open source de lo privado.

---

## 3. Arquitectura

```
Website del cliente
        │
        ▼
JavaScript SDK (trell.js)   ← instrumenta formularios existentes, emite eventos
        │  batch + beacon
        ▼
        API  (trell-api)
        │   ├── POST /v1/events   (ingestión, clave pública)
        │   └── /v1/projects/*    (gestión + stats, clave secreta)
        ▼
Event ingestion → valida, normaliza, escribe
        ▼
Database (PostgreSQL)
        ├── events  (append-only)   ← datos crudos
        └── rollups (metricas agregadas por periodo)
        ▼
Analytics dashboard (trell-dashboard)   ← consulta la management API
```

Componentes mínimos del MVP:

1. **SDK** (`trell.js`) — corre en el navegador del cliente.
2. **API** — ingestión + management. Puede ser self-hosted o managed.
3. **DB** — Postgres con un schema simple.
4. **Dashboard** — lectura de métricas agregadas.

---

## 4. SDK

### 4.1 Objetivos de diseño

- Framework-agnóslico: funciona en cualquier sitio que ejecute JS.
- **Ligero**: objetivo `< 5 KB` gzip, cero dependencias en runtime.
- **No intrusivo**: no toca el HTML del formulario; observa y escucha sin
  inyectar elementos.
- Detección de SPAs y formularios creados dinámicamente.

### 4.2 Instalación

Snippet mínimo (como Plausible/Dub/PostHog):

```html
<script
  defer
  src="https://cdn.trell.dev/sdk.js"
  data-project="pk_live_..."       <!-- clave pública -->
  data-domain="misitio.com"        <!-- origen permitido -->
></script>
```

O programático (para bundlers/frameworks):

```js
import { init } from "@trell/sdk";

const trell = init({
  project: "pk_live_...",
  domain: "misitio.com",
});
```

### 4.3 Dos modos de uso

**A) Declarativo (auto-detección, cero código).** El SDK encuentra automáticamente
los formularios y elementos de trabajo. Ejemplo con atributos de datos:

```html
<form data-trell-form="contacto" data-trell-name="Contacto">
  <input name="email" />
  <button type="submit">Enviar</button>
</form>
<button data-trell-cta="pricing">Ver pricing</button>
```

**B) Imperativo (control manual).** Para sitios con flujos custom o SPA:

```js
const trell = init({ project: "pk_..." });

trell.registerForm({
  id: "checkout",
  name: "Checkout",
  selector: "#mi-formulario",
});

trell.track("form_submit", { form: "checkout", properties: { plan: "pro" } });

// Marcar éxito cuando el backend lo confirma (ver §4.5)
trell.success("checkout");
```

### 4.4 Conjunto de eventos (schema v1)

| Evento | Detonante | Notas |
|--------|-----------|-------|
| `form_view` | el formulario entra en viewport (IntersectionObserver) | = "visita al formulario" |
| `form_start` | primera interacción real (foco/input/change) en el form | = "formulario iniciado" |
| `field_interaction` | cada campo que recibe foco/cambio | agregado por campo |
| `form_submit` | evento `submit` (antes de validar) | intento |
| `form_success` | confirmación de éxito (ver §4.5) | = "formulario completado" |
| `form_abandon` | empezado pero sin éxito al salir/sesión | best-effort |
| `cta_click` | click en elemento `[data-trell-cta]` | bajo prioridad en MVP |

### 4.5 Semántica del "éxito" (punto crítico)

El SDK no puede saber por sí solo si el submit llegó al servidor. Contrato claro,
priorizado:

1. **Callbacks**: se dispara `trell.success(formId)` / `data-trell-success` cuando
   el usuario confirma éxito en su propio código. La opción más fiable.
2. **Detección de UI**: `MutationObserver` detecta cambios que suelen acompañar al
   éxito (contenido nuevo, clase `.success`/`.error`, cambio de URL visible).
   Configurable y opcional.
3. **Timeout de cooldown**: si hay `form_submit` y no llega confirmación de error
   en N ms y la página permuta, se considera éxito best-effort.

Sin confirmación explícita, **no** se marca `form_success` para no inflar la tasa
de conversión. Este es un trade-off documentado.

### 4.6 Payload de evento (compacto, batchable)

```jsonc
{
  "v": 1,
  "project": "pk_live_...",
  "type": "form_submit",
  "ts": 1730000000000,
  "session_id": "uuid",
  "visitor_id": "uuid",
  "url": "https://misitio.com/contacto",
  "referrer": "https://google.com",
  "utm": { "source": "google", "medium": "cpc", "campaign": "summer", "term": null, "content": null },
  "device": { "type": "mobile", "os": "ios", "browser": "safari", "viewport": [390, 844] },
  "form": { "id": "contacto", "name": "Contacto" },
  "page": { "title": "Contacto", "path": "/contacto" },
  "field": "email",          // solo en field_interaction
  "properties": { "plan": "pro" }
}
```

- `utm` se captura del `document.referrer` + URL de entrada + `sessionStorage`
  (sobrevive navegación interna).
- `device` se detecta sin librerías (UA heuristico + viewport).
- `properties` permite datos custom arbitrarios.

### 4.7 Transporte y batching

- Buffer de eventos en memoria; flush cada X ms o al `pagehide`/`visibilitychange`.
- `navigator.sendBeacon` en navegación; `fetch` con `keepalive` en evento activo.
- El batch va como `Content-Type: application/json` a `POST /v1/events`.
- Circuit-breaker y silencio de errores: si la API no responde, el SDK no rompe
  el sitio del cliente.

### 4.8 Identidad y privacidad

- `visitor_id`/`session_id`: UUID aleatorio en cookie de primera parte o
  localStorage. Sin PII.
- No se recolectan emails ni datos personales por defecto.
- Modo **cookieless** / respeto `navigator.doNotTrack` y opción de consentimiento
  (data-attr `data-trell-privacy="mandatory"`): no persiste cookie.

---

## 5. Modelo de datos

### 5.1 Tablas

**Modelo de auth (estilo Dub / Auth.js):**

- **`users`** — identificadores de usuarios. `id`, `email` (unique), `name`,
  `image`, `emailVerified`, `lastLoginAt`, `createdAt`/`updatedAt`.
- **`accounts`** — cuentas OAuth (provider, providerAccountId, token, etc.) para
  GitHub/Google. Relación `userId`.
- **`sessions`** — sesiones de Auth.js en DB (token, expires, userId).
- **`verification_tokens`** — tokens de magic link/OTP (identifier, token, expires).
- **`project_users`** — membresía con rol: `projectId`, `userId`, `role`
  (`owner` | `member`). Modela el multi-tenant de Dub.

**`projects`** — tenant/entidad trackeada; cada proyecto es "un sitio".

| columna | tipo | notas |
|---------|------|-------|
| `id` | uuid pk | |
| `name` | text | |
| `slug` | text unique | para URLs públicas |
| `api_key_hash` | text | `sk_...` hasheada (nunca en claro) |
| `publishable_key` | text unique indexed | `pk_...` expuesta en el SDK |
| `domain` | text | allowlist de orígenes para CORS |
| `created_at` | timestamptz | |

> El flujo emisor de claves es idéntico al de Dub: la `sk_` se muestra una vez al
> crear/rotar el proyecto y luego solo se guarda su hash. La `pk_` es segura y se
> sirve al público para el SDK.

**`forms`** — formularios registrados dentro de un proyecto.

| columna | tipo | notas |
|---------|------|-------|
| `id` | uuid pk | |
| `project_id` | uuid fk→projects | |
| `name` | text | etiqueta (ej. "Contacto") |
| `selector` | text | como se identifica |
| `url_pattern` | text | opcional |
| `created_at` | timestamptz | |

**`events`** — stream append-only de eventos (tabla principal).

| columna | tipo | notas |
|---------|------|-------|
| `id` | bigint / snowflake pk | |
| `project_id` | uuid fk→projects | |
| `event_type` | enum | ver §4.4 |
| `ts` | timestamptz | hora del evento |
| `session_id` | uuid | |
| `visitor_id` | uuid | |
| `form_id` | uuid nullable | fk→forms (si está registrado) |
| `form_name` | text nullable | snapshot por si el form se borra |
| `url` | text | página donde ocurrió |
| `referrer` | text | |
| `utm_source`/`utm_medium`/`utm_campaign`/`utm_term`/`utm_content` | text | normalizadas en columnas |
| `device_type` | text | desktop/tablet/mobile |
| `os` | text | |
| `browser` | text | |
| `viewport_width`/`viewport_height` | int | |
| `page_title` | text | |
| `field` | text nullable | para `field_interaction` |
| `properties` | jsonb | custom |
| `raw` | jsonb | payload original (debug/replay) |

**`daily_form_metrics`** — rollup agregado para consultas rápidas del dashboard.

| columna | tipo |
|---------|------|
| `project_id`, `form_id`, `day` | clave compuesta |
| `views`, `starts`, `submits`, `successes`, `abandons` | int |
| `avg_time_to_complete_ms` | int |
| `visitors` | int (distintos) |

### 5.2 Índices

- `events (project_id, event_type, ts)` — filtros por métrica y tiempo.
- `events (form_id, ts)` — breakdown por formulario.
- `events (visitor_id, ts)` — sesiones/visitors únicos.
- Único parcial por `(project_id, day, form_id)` en `daily_form_metrics`.

### 5.3 Definición de métricas (fuente de verdad)

| Métrica | Definición |
|---------|-----------|
| Visitas al formulario | `count(form_view)` |
| Formularios iniciados | `count(form_start)` |
| Formularios completados | `count(form_success)` |
| Tasa de conversión | `successes / views` (o `successes / starts`; se aclara en UI) |
| Abandonados | `starts - successes` (o `count(form_abandon)`) |
| Tiempo hasta completo | `avg(success_ts - start_ts)` por sesión/formulario |
| Origen/UTM | group by `utm_*` (con fallback a `referrer`) |
| Dispositivo | group by `device_type` |
| Página | group by `url`/`page_title` |

---

## 6. API

### 6.1 Modelo de auth (dos claves)

- `pk_...` (publishable): solo puede hacer `POST /v1/events`. Segura para exponer
  en el navegador. Validada contra el `domain` del proyecto (CORS + verificación
  de `Origin`).
- `sk_...` (secret): acceso total a gestión y métricas. Servidor/dashboard.

### 6.2 Endpoints

**Ingestión (clave pública):**

- `POST /v1/events`
  Body: array de eventos (batch) u objeto único.
  Respuesta: `204` (aceptado de forma asíncrona) o `202` con conteo.
  Errores: `400` schema inválido, `403` origin/key no permitido, `429` rate limit.

**Management (clave secreta):**

- `POST /v1/projects` → crear proyecto (devuelve `pk` + `sk`).
- `GET /v1/projects/:id` → detalle.
- `POST /v1/projects/:id/forms` → registrar un formulario.
- `GET /v1/projects/:id/forms` → listar.
- `GET /v1/projects/:id/stats?from&to&interval&dimension` → métricas agregadas
  (devuelve series para el dashboard). `dimension` ∈ `form | device | utm_source |
  page`.

**Health:** `GET /health` → `200`.

### 6.3 Ingestion (contrato)

- Límite de tamaño por request (ej. 256 KB).
- Validación de schema (typing estricta por evento) antes de escribir; los
  inválidos se descartan y se cuentan.
- Escalado: los eventos se agregan en batchs (`INSERT ... ON CONFLICT DO NOTHING`)
  y luego se calcula el rollup `daily_form_metrics` (on-demand o por job).

### 6.4 Rate limits y seguridad

- Límite por proyecto y por visitor/session.
- `429` con `Retry-After`; el SDK respeta backoff.
- Nunca loguear claves; `sk_` se guarda hasheada con `bcrypt`/`argon2`.

---

## 7. Flujo mínimo (end-to-end)

1. El usuario se registra y **crea un proyecto** → recibe `pk_live_...` +
   `sk_...` + el snippet.
2. **Instala** el snippet/`init()` en su sitio.
3. El SDK **descubre e instrumenta** los formularios existentes.
4. Ante interacciones, el SDK **emite eventos** en batch hacia `POST /v1/events`.
5. La **API valida** (pk + origin + schema) y **escribe** en `events`.
6. Los **rollups** agregan métricas por día/formulario.
7. El **dashboard** consulta la management API y muestra: visitas, inicios,
   completados, tasa de conversión, abandonos, tiempo, UTM, dispositivo, página.
8. El usuario ve qué canales y qué páginas convierten mejor.

---

## 8. Seguridad y privacidad

- Claves pública/privada separadas; `sk_` nunca en el cliente.
- Allowlist de dominios (CORS + validación de `Origin`) por proyecto.
- No recolecta PII por defecto; `properties` con allowlist de claves configurable.
- Modo cookie-less + respeto `Do Not Track` + consentimiento (GDPR).
- Retención de datos configurable por proyecto.
- En ingestion: validación estricta, límites de tamaño, rate limit, backoff.
- En el servidor: no loggear claves, hashear secretos, no almacenar payloads
  sensibles más de lo necesario.

---

## 9. Estructura del repositorio (monorepo)

```
trell/
  apps/
    sdk/          # SDK browser (TS → ESM + IIFE), ligero, sin deps
    web/          # Dashboard + Auth.js (Next.js) — login, projects, stats
    api/          # Hono: ingestion + management API (ska)
  packages/
    db/           # Prisma schema + migraciones + tipos (Postgres)
    auth/         # Auth.js/NextAuth config (email + OAuth), sesiones DB
    email/        # Emails (Resend) para magic links
    shared/       # tipos + validadores del schema de eventos (zod)
    ui/           # componentes de UI compartidos
  docs/           # este doc, guías, plugin del SDK
  docker-compose.yml   # self-host: web + api + postgres + redis
  turbo.json
  pnpm-workspace.yaml
```

El paquete `shared` garantiza que SDK, API y dashboard coincidan en el schema de
eventos (single source of truth).

---

## 10. Alcance MVP

**Dentro del MVP:**

- Proyecto + claves (`pk`/`sk`).
- SDK universal: auto-detección + API imperativa.
- Eventos: `form_view`, `form_start`, `field_interaction`, `form_submit`,
  `form_success`, `form_abandon`.
- Ingestion batch + validación.
- Métricas: visitas, inicios, completados, tasa de conversión, abandonos, tiempo,
  UTMs, dispositivo, página.
- Dashboard mínimo con esos gráficos/tablas.
- Self-hostable (docker-compose).

**Fuera del MVP (fases posteriores):**

- CTA/click tracking avanzado y heatmaps.
- `cta_click` como evento de baja prioridad.
- Funnels, eventos personalizados, webhooks, integraciones (Slack, etc.).
- Wrappers por framework (React/Vue).
- Billing del servicio administrado, multi-tenant avanzado, RBAC de orgs.
- Migración de ingestion a ClickHouse a muy alta escala.

---

## 11. Open source vs privado (gobernanza)

**Open source:**

- SDK (`apps/sdk`).
- paquete `shared` (schema/válidadores).
- schema y migraciones de DB (`packages/db`).
- API (`apps/api`) — toda self-hostable.
- Dashboard (`apps/dashboard`) — self-hostable.
- Documentación y guías.
- `docker-compose.yml`.

**Privado (solo managed SaaS):**

- Infraestructura administrada: hosting de la API, CDN del SDK, ClickHouse.
- Auth/identidad de cuentas, planes y **billing**.
- Rate limits y límites de uso administrados.
- Gestión de secretos del provider, seguridad/monitorización/costos del servicio.
- Multi-tenant y aislamiento fino de la plataforma administrada.
- Orquestación de ingestion y jobs de rollup.
- Funcionalidades premium (webhooks, integraciones, funnels, heatmaps).

Motivo: los secretos de infra, billing y operación no deben ser públicos; el
producto open source replica el comportamiento en "modo self-hosted".

---

## 12. Decisiones finales (resueltas)

| Área | Decisión |
|------|----------|
| Auth de usuarios | Completo estilo Dub: Auth.js/NextAuth, magic link (Resend) + GitHub/Google, sesiones en DB, proyectos con roles |
| Email | **Resend al inicio bajo una abstracción `Auth → EmailProvider → Resend`**, dejando hueco para `→ SMTP` en self-host |
| API | TypeScript + Hono |
| DB ORM | **Prisma** |
| Database | PostgreSQL |
| Analytics | **Postgres + rollups** (eventos + agregaciones). ClickHouse/Tinybird solo si el volumen lo exige (futuro: `SDK → ingestion → queue → ClickHouse`) |
| Monorepo | Turborepo |
| SDK | TypeScript/JavaScript universal |
| Repo | Monorepo |
| Nombre | trell |

> **Racional key:** Prisma por velocidad de desarrollo y paridad conceptual con
> Dub, pero **sin** guardar cada evento para siempre ahí (scroll a rollups).
> Email desacoplado para no atar el self-host a una API externa. Analytics en
> Postgres hasta no validar demanda real — no diseñar infra para millones de
> eventos antes de tener usuarios.

---

## 13. Siguiente paso (Prompt 02 sugerido)

Aprobar estas decisiones y definir en detalle el **contrato JSON del SDK**
(`trell.js`): firma de `init`, API pública (`track`, `registerForm`, `success`,
`addEventListener`), snippet de auto-configuración y el schema preciso de cada
evento con su validación.
