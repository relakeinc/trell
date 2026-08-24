# Trell — Prompt 03 · Estado de implementación

> **Qué se implementó y qué falta.** Documento de handoff tras el Prompt 03.
> El contrato (`docs/sdk-contract.md`) **no fue modificado** y sigue siendo la
> fuente de verdad.

---

## 1. Qué se implementó

### Monorepo (Turborepo + pnpm, TypeScript)
- Raíz: `package.json` (workspaces), `pnpm-workspace.yaml`, `turbo.json`,
  `tsconfig.base.json` (strict), `.gitignore`.
- Comandos: `pnpm build`, `pnpm test`, `pnpm typecheck` (vía turbo).

### `packages/shared` — `@trell/shared`
- `src/types.ts`: todos los tipos públicos del contrato (§3, §4, §7): `EventType`,
  `BaseEvent`, `Utm`, `Device`, `FormContext`, payloads por tipo, `EventPayload`,
  `TrellConfig`, `FormConfig`, `SuccessDetection`, `TrackOptions`, `Identity`,
  `Trell`, `TrellForm`. **Single source of truth.**
- `src/constants.ts`: constantes de transporte (§13).
- `src/schemas.ts`: esquemas zod (autoridad, lado API). `@trell/shared/schemas`.
- Exports separados: `.` (tipos + constantes, sin zod) y `./schemas` (zod).

### `apps/sdk` — `@trell/sdk` (el corazón)
- API pública mínima: `init`, `track`, `form`, `identify` (`src/index.ts`).
- `src/engine.ts`: `TrellEngine` — orquesta context + transport + auto-detección.
- `src/context.ts`: `visitor_id`, `session_id` (idle), UTM first-touch, URL/referrer,
  detección de device sin librerías.
- `src/payload.ts`: construye el envelope dle evento y mergea `properties`
  (defaults < identify < extra < options), `value` → `properties.value`.
- `src/validate.ts`: mini-validator interno (sin zod, sin dependencia).
- `src/transport.ts`: batch, split por `MAX_PAYLOAD_BYTES`, retries (backoff),
  `Retry-After`, `429`/`5xx`, cola offline + `online`, `sendBeacon` en `pagehide`,
  idempotencia por `event_id`, header `Authorization: Bearer <pk>`.
- `src/auto.ts`: auto-detección declarativa (`[data-trell-form]`), `form_view`
  (IntersectionObserver), `form_start`, `field_interaction` (throttle 300ms),
  `form_submit`, `form_success` (manual + Mutación si `success` es objeto),
  `form_abandon` (pagehide/visibilitychange), `cta_click` (delegado).
- `src/rng.ts`, `src/storage.ts`: UUID/utility + persistencia (cookie/LS) y modo
  cookie-less (`strict`, DNT/GPC, consent).
- Auto-init desde el snippet clásico (`data-*`), guardado con `document.currentScript`.

### Tests — 32/32 pasando (`apps/sdk/test`)
- `payload.test.ts` (5): envelope, merge de properties, value, form context, cta.
- `validate.test.ts` (7): válidos/inválidos por tipo + eventos custom.
- `context.test.ts` (6): visitor estable, session idle, UTM first-touch, device.
- `transport.test.ts` (8): batching, flush crítico, header `pk`, split de payload,
  retries 5xx, `Retry-After` 429, drop 4xx, cola offline → `online`.
- `engine.test.ts` (6): integración `init`/`track`/`form`/`identify` + submit,
  field, cta, view y success auto-detectados en el DOM.

---

## 2. Estado de build / tamaño
- `pnpm build` ✓ (shared + sdk). `pnpm typecheck` ✓ (shared + sdk, strict).
- Bundle SDK:
  - **snippet (IIFE)** `dist/index.global.js`: **14.9 KB min, 5.8 KB gzip**,
    **0 referencias a zod / @trell/shared** (auto-contenido) → cumple "sin deps
    de framework".
  - ESM/CJS (`dist/index.js`): conserva `import ... from "@trell/shared"`
    (constantes enlazadas). Sin zod, sin frameworks.

---

## 3. Qué falta (fuera del alcance del Prompt 03)
- **`apps/api`** (Hono): ingestion + management + claves pk/sk + validación zod
  autoritativa. **Por implementar.**
- **`apps/web`** (Next.js + Auth.js): login, dashboard, proyectos/forms, stats.
  **Por implementar.**
- `packages/db` (Prisma), `packages/auth`, `packages/email`, `packages/ui`.
- Eventos prefabricados "precisos" de conversion-tracker extras (solo el set de §6).
- Rollups/agregaciones del dashboard.

---

## 4. Desviaciones / notas (a decidir en prompt siguiente)
1. **Bundle > objetivo**: 5.8 KB gzip vs meta "< 5 KB". Cercano; se puede
   optimizar luego (minificar a mano, tarpara libs).
2. **`form().destroy()`** es un no-op (la re-registración limpia listeners; no hay
   destach real). Simple.
3. **`identify`** actualmente mapea `userId`→`identify_user` y `emailHash`→
   `identify_email` asumiendo que el llamador ya hashea. El contrato (§8.3) pide
   que el SDK **hashee** (SHA-256 + salt). **A confirmar semántica exacta en el
   Prompt 04** (el `sha256Hex` ya está en `src/rng.ts`, sin cablear).
4. **Auto-detección de éxito** por defecto desactivada (solo manual, como especifica
   §5); se activa si `form({ success: {...} })`.
5. `apps/api` y `apps/web` devuelven warnings de turbo ("no output files") — son
   placeholders. Inofensivo.

---

## 5. Contrato
- `docs/sdk-contract.md`: **sin cambios**.
- No se encontraron contradicciones bloqueantes durante la implementación; las
  ambigüedades están listadas en §4.
