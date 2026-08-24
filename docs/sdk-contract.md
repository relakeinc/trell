# Trell — Prompt 02 · Contrato del SDK

> **Estado: CONTRATO CONGELADO. SOLO DEFINICIÓN — NO IMPLEMENTAR AÚN.**
> Este documento define el contrato público y el comportamiento del SDK
> (`@trell/sdk`). Ningún código debe escribirse hasta que este contrato se dé por
> cerrado. Se revisa en el Prompt 03+ para implementar.

---

## 0. Principios del SDK

1. **API pública mínima.** 4 métodos: `init`, `track`, `form`, `identify`. Nada más
   en la superficie. No se añaden métodos "por si acaso".
2. **Cadena de framework** (vanilla TS). Funciona en HTML/React/Vue/Next/Astro/
   Svelte/WP con la misma librería. **Sin wrappers** en el MVP.
3. **No intrusivo.** No toca el HTML del formulario, no inyecta elementos, no
   interviene en `submit` (solo observa). No rompe el sitio del cliente.
4. **Ligero.** Objetivo `< 5 KB` gzip. **Cero dependencias** de runtime.
5. **Silencioso.** Nunca lanza excepciones al host page; los errores se tragan
   (o se logean si `debug`). El cliente no debe saber que algo falló.
6. **Privacy-first.** Sin PII por defecto; modo cookie-less; respeta DNT/GPC.

---

## 1. Carga del SDK (dos modos)

**A) Snippet (no module) — auto-inicializa desde `data-*`:**

```html
<script
  defer
  src="https://cdn.trell.dev/sdk.js"
  data-project="pk_live_xxx"
  data-domain="misitio.com"
></script>
```

- Lee los atributos `data-*`, inicializa automáticamente y expone `window.trell`
  (la instancia creada) tras cargar.
- Atributos soportados en el tag del script:
  - `data-project` (requerida) → `pk_...`
  - `data-domain` (recomendada) → allowlist de origen
  - `data-endpoint` → endpoint custom (self-host/proxy)
  - `data-privacy` → `consent` | `strict`
  - `data-debug` → activa logs (presencia del atributo)

**B) Module (bundler):**

```js
import { init } from "@trell/sdk";

const trell = init({
  project: "pk_live_xxx",
  domain: "misitio.com",
});
```

> En modo snippet, `window.trell` es la única instancia. En modo module, `init()`
> devuelve una instancia aislada y **no** toca `window.trell` (salvo config
> explícita `exposeGlobal: true`).

---

## 2. API pública (la superficie completa)

```ts
type Trell = {
  init: undefined; // ya ejecutado; la instancia es el objeto devuelto/expuesto

  track(type: EventType | string, options?: TrackOptions): void;
  form(config: FormConfig): TrellForm;
  identify(identity: Identity): void;
};

type TrellForm = {
  /** Confirma el éxito del formulario. Dispara `form_success`. El camino más fiable. */
  success(options?: TrackOptions): void;
  /** Desconecta listeners y limpia el registro. */
  destroy(): void;
};
```

**Regla de oro:** todo lo demás (batch, retry, UTM, device, session, etc.) es
**interno**. No se expone `flush()`, `getVisitorId()`, `setUtm()`... salvo que una
necesidad real lo justifique en un prompt posterior.

**Confirmado:** `form().success()` y `track("form_success", { form })` son **dos
vías equivalentes** para confirmar éxito — misma semántica, ambas soportadas.

### 2.1 `init(config: TrellConfig): Trell`

Carga la configuración, infiere contexto (UTM, device, ids), registra formularios
declarativos (`[data-trell-form]`) y arranca la detección automática.

### 2.2 `track(type, options): void`

Envía un evento manual. `type` puede ser un evento estándar (`EventType`) o un
nombre custom (habilita eventos propios sin tocar el SDK).

```ts
trell.track("cta_click", { cta: "pricing" });
trell.track("form_success", { form: "checkout", properties: { plan: "pro" } });
trell.track("mi_evento_custom", { properties: { foo: "bar" } });
```

### 2.3 `form(config: FormConfig): TrellForm`

Registra/configura un formulario (para SPAs/flow custom). Devuelve un handle con
`.success()` y `.destroy()`. Idempotente por `id`.

- **`.destroy()` es funcional** (decidido en Prompt 09): elimina los listeners del
  elemento, desconecta observers (IntersectionObserver/MutationObserver), limpia
  timers asociados y el estado del formulario. `destroy()` + `form()` de nuevo sobre
  el mismo `id` **no duplica** listeners ni eventos (re-incialización segura).
  `destroy()` es idempotente (no-op si el form no está registrado).

### 2.4 `identify(identity: Identity): void`

Vincula el visitante anónimo a un usuario conocido. **Semántica (decidido en
Prompt 09): el SDK recibe el identificador CRUDO y hashea por dentro — nunca
transmite PII cruda.**

```ts
trell.identify({ userId: "user_123", email: "user@mail.com" });
```

- `Identity = { userId?: string; email?: string }` (**valores crudos**).
- El SDK calcula **SHA-256** sobre cada valor provisto y **solo envía el hash**
  en `properties` (`identify_user` = sha256(userId), `identify_email` = sha256(email)).
- **Nunca** se coloca el valor crudo en ningún campo del evento; solo existe de forma
  transitoria para calcular el hash.
- El hash es **síncrono** (SHA-256 en JS puro, determinista en cualquier entorno, sin
  depender de `crypto.subtle`); la atribución se mezcla en `properties` de inmediato.
- No cambia `visitor_id`; lo "decoran".

---

## 3. `TrellConfig`

```ts
type TrellConfig = {
  /** Requerida. Clave pública del proyecto (pk_). */
  project: string;

  /** Origen permitido (dominio). Recomendada; se valida en la API vía CORS/Origin. */
  domain?: string;

  /** Endpoint de ingestion. Default: https://api.trell.dev/v1/events */
  endpoint?: string;

  /** Auto-detectar formularios/CTAs declarativos. Default: true. */
  autoDetect?: boolean;

  /** Registro previo de formularios (se procesa igual que trell.form()). */
  forms?: FormConfig[];

  /** 0..1 — probabilidad de muestreo. Default: 1. */
  sampleRate?: number;

  /** Modo privacidad. 'consent' (esperar consentimiento) | 'strict' (cookie-less). */
  privacy?: "consent" | "strict";

  /** Si hubo consentimiento ya otorgado (para privacy:'consent'). */
  consent?: boolean;

  /** Loggear a consola. Default: false. */
  debug?: boolean;

  /** Propiedades por defecto que se mezclan en todo evento. */
  defaults?: Record<string, unknown>;

  /** Exponer el SDK como window.trell en modo module. Default: false. */
  exposeGlobal?: boolean;
};
```

---

## 4. Identificación de proyecto y formulario

### 4.1 Proyecto
Identificado por `project` (la `pk_...`). La `pk_` se envía en cada evento y la API
la usa para resolver el proyecto + verificar el `domain`.

### 4.2 Formulario
Cada formulario trackeado tiene un `id` (slug estable) y un `name` (etiqueta). El
`id` es la dimensión clave para las métricas. Snapshot del `name` por si el form se
borra después.

```ts
type FormConfig = {
  /** Requerido. Identificador estable (slug). Ej: "checkout". */
  id: string;
  /** Etiqueta legible. Ej: "Checkout". */
  name?: string;
  /** Requerido. Selector CSS del <form> o contenedor. */
  selector: string;
  /** Campos a observar para field_interaction. Default: todos los inputs. */
  fields?: string[];
  /** Campos a ignorar. */
  ignore?: string[];
  /** Estrategia de detección de éxito (ver §5.4). */
  success?: SuccessDetection;
};
```

**Modo declarativo** (autoDetect):
```html
<form data-trell-form="contacto" data-trell-name="Contacto">
  <input name="email" />
  <button type="submit">Enviar</button>
</form>
```
- `[data-trell-form="id"]` sobre `<form>` o un contenedor.
- Atributos de form: `data-trell-name`, `data-trell-fields`, `data-trell-ignore`.
- Campos a excluir: `data-trell-ignore` en el input.
- CTAs: `<button data-trell-cta="pricing">`.

---

## 5. Detección de éxito / submit (punto crítico)

En SPAs (React/Vue) y formularios con `preventDefault` + `fetch`, el evento nativo
`submit` **puede no dispararse**. Estrategia en cascada (de más a menos fiable):

### 5.1 Manual (más fiable)
`formHandle.success(options?)` o `track("form_success", { form })` cuando el
usuario confirma éxito en su propio código.

### 5.2 Auto — detección de UI
`MutationObserver` + heurística configurable: contenido nuevo que sugiere éxito
(clase `.success`, texto de confirmación, cambio de URL visible, formulario
ocultado). Configurable en `SuccessDetection`:

```ts
type SuccessDetection =
  | false                                   // desactivar auto (solo manual)
  | { observed: string[]; throttleMs?: number; timeoutMs?: number };
```

### 5.3 Cooldown / timeout (best-effort)
Si hubo `form_submit` reciente y no hay evidencia de error en un `timeoutMs` y la
UI muta, se infiere éxito. Trade-off documentado: **no** inferir éxito sin señales
para no inflar la tasa de conversión.

### 5.4 No interferencia
El SDK **nunca** llama a `preventDefault()` ni altera la validación. Solo escucha.
`form_submit` incluye si el form era válido (`checkValidity()`).

---

## 6. Eventos automáticos (autoDetect)

| Evento | Detonante | Qué se envía |
|--------|-----------|--------------|
| `form_view` | el form entra en viewport (IntersectionObserver) | `FormEvent` |
| `form_start` | primera interacción real (focusin/change/pointerdown) | `FormEvent` |
| `field_interaction` | foco/cambio en un campo (throttled ca. 300ms) | `FormEvent` + `field` |
| `form_submit` | evento `submit` (sin intervenir) | `FormEvent` + `valid` |
| `form_success` | confirmación (manual o auto §5) | `FormEvent` + `time_to_success_ms?` |
| `form_abandon` | `started` sin `success` al terminar sesión/página | `FormEvent` + `duration_ms` |
| `cta_click` | click en `[data-trell-cta]` (delegado) | `{ cta, label?, href? }` |

`cta_click` es de **baja prioridad** en el MVP; se documenta pero la medición
principal sigue siendo de formularios.

---

## 7. Schema de evento (envelope + payloads)

Todo evento se serializa a este JSON. **TS es fuente de verdad** (paquete `shared`).

```ts
export type EventType =
  | "form_view" | "form_start" | "field_interaction"
  | "form_submit" | "form_success" | "form_abandon"
  | "cta_click";

// ---------- Envelope común ----------
export interface BaseEvent {
  v: 1;                     // versión del schema
  event_id: string;         // UUID — idempotencia en el servidor
  project: string;          // pk_
  type: EventType | string; // tipo o custom
  ts: number;               // epoch ms, reloj del cliente
  session_id: string;
  visitor_id: string;
  url: string;              // URL completa al momento de captura
  page: { path: string; title: string };
  referrer: string;
  utm: Utm | null;
  device: Device;
  properties: Record<string, unknown>;   // merge de defaults + call + identify
}

export interface Utm {
  source: string | null; medium: string | null; campaign: string | null;
  term: string | null; content: string | null;
}

export interface Device {
  type: "desktop" | "tablet" | "mobile";
  os: string | null;
  browser: string | null;
  viewport: [number, number];   // [width, height]
}

// ---------- Payloads por tipo ----------
export interface FormContext { id: string; name?: string; }

export interface FormEvent extends BaseEvent {
  type: Exclude<EventType, "cta_click">;
  form: FormContext;
}

export interface FieldInteractionEvent extends FormEvent {
  type: "field_interaction";
  field: string;
  interaction: "focus" | "change";
}

export interface FormSubmitEvent extends FormEvent {
  type: "form_submit";
  valid: boolean;
}

export interface FormSuccessEvent extends FormEvent {
  type: "form_success";
  timeToSuccessMs?: number;
}

export interface FormAbandonEvent extends FormEvent {
  type: "form_abandon";
  durationMs: number;
}

export interface CtaClickEvent extends BaseEvent {
  type: "cta_click";
  cta: string;
  label?: string;
  href?: string;
}

export type EventPayload =
  | FieldInteractionEvent
  | FormSubmitEvent
  | FormSuccessEvent
  | FormAbandonEvent
  | CtaClickEvent
  | (BaseEvent & { type: EventType });
```

**Propiedades `properties`:**
- Se agregan vía `defaults` (config), `identify`, y el `options.properties` del call.
- Merge: `defaults` < `identify` < `options.properties` (el último gana).
- Serán **opcionales/consentidas** según privacy; sin PII por defecto.

---

## 8. Identidad

### 8.1 `visitor_id` (anónimo, persistente)
- UUID aleatorio.
- Persistido en cookie de primera parte (`trell:vid`, ~1 año) o `localStorage`.
- Modo `strict`: solo en memoria (no persiste → no deduplica entre visitas).

### 8.2 `session_id` (una visita/sesión)
- UUID aleatorio.
- Persistido en `sessionStorage` (por tab) con fallback cookie.
- Regenerado tras inactividad (ca. 30 min) o update (cambio de tab/session).

### 8.3 `identify()`
- Vincula un usuario conocido a `visitor_id`.
- Recibe el identificador **crudo** (`{ userId?, email? }`) y calcula **SHA-256** por
  dentro (síncrono, JS puro); solo persiste/envía el **hash**
  (`identify_user`/`identify_email`), no el valor crudo.
- No cambia `visitor_id`; lo "decoran".

---

## 9. Contexto capturado

### 9.1 UTM
- Leídas de la URL de entrada (`utm_source/medium/campaign/term/content`).
- Almacenadas en `sessionStorage`/memoria para sobrevivir navegación interna.
- Política: **first-touch wins** (la primera captura prevalece).
- Default `null` si no hay UTM. Fallback de origen: `referrer` (ver 9.2).

### 9.2 URL / referrer
- `url` = `location.href` al momento de captura (para `form_view`, la del view).
- `referrer` = `document.referrer`.
- `page.title` = `document.title`; `page.path` = `location.pathname`.

### 9.3 Device
- Derivado del cliente **sin librerías**: `navigator.userAgent` +
  `navigator.platform` + `navigator.userAgentData` (si existe) + viewport.
- `type`: heuristico por UA + viewport; `os`/`browser`: parseo ligero.
- Todo es heurística; el servidor puede revalidar/no consienta.

---

## 10. Transporte

### 10.1 Batching
- Buffer interno de eventos; flush por **tamaño** o **intervalo**:
  - Flush inmediato para `form_submit` y `form_success` (críticos).
  - Otros: flush al llegar a `MAX_BATCH` (10) o `MAX_BATCH_INTERVAL` (5 s).
- En `pagehide`/`visibilitychange→hidden`: vacío el buffer con `sendBeacon`.

### 10.2 sendBeacon
- `navigator.sendBeacon(endpoint, Blob(JSON, { type: "application/json" }))` en
  navegación/hidden. Si no existe, fallback a `fetch(url, { keepalive: true })`.

### 10.3 Retries
- En POST interactivo que falle (red/5xx): reintenta hasta 3 veces con backoff
  exponencial + jitter.
- En `429`: respeta `Retry-After` (respeta backoff), luego descarta.
- `sendBeacon`: **no** se reintenta (no se puede saber si llegó).
- Idempotencia por `event_id`.

### 10.4 Offline / cola
- Si `navigator.onLine === false` o fetch falla: encola en memoria (o
  `sessionStorage` si se tolera durabilidad, tope `MAX_QUEUE`).
- Al evento `online`: flush.
- Cap de cola: descarta el más antiguo (no crecimiento ilimitado).
- Si cierra la página con eventos sin enviar: intento `sendBeacon`; si no, se
  pierden (trade-off documentado).

### 10.5 Tamaño máximo de payload
- Límite por request `MAX_PAYLOAD` (64 KB). Si el batch excede: se divide en
  varios requests.
- `properties`/`value` por evento acotados a `MAX_PROPERTY` (4 KB); el SDK corta
  propiedades demasiado grandes.

---

## 11. Validación y errores

**En el SDK:**
- El SDK valida su propio payload con un mini-assert (internal, **no** dependencia).
- Eventos inválidos: se descartan; se logean solo con `debug`.
- El SDK **no lanza** errores al host. Todo se envuelve en try/catch; si falla,
  se limpia y el buffer sobrevive.

**En la API (autoridad):**
- Validación estricta con zod (paquete `shared`).
- `400` schema inválido, `403` origin/key no permitido, `429` rate limit.
- El SDK responde a estos códigos sin propagar errores al cliente.

---

## 12. Privacidad

- **Sin PII por defecto.** No se recolectan emails/nombres ni datos personales.
- `identify`: guarda **hash**, no valor crudo; enviar PII cruda requiere
  `sendIdentityPii: true` (explicito, default `false`, validado en servidor).
- Modo `strict` (cookie-less): `visitor_id` en memoria, respeta `Do Not Track` y
  `Global Privacy Control` → no persistir.
- Modo `consent`: espera señal de consentimiento (`consent: true` o evento) antes
  de persistir/enviar; si no hay consentimiento, solo modos no persistentes.
- Retención y borrado: se configura en la API; el SDK no guarda datos de usuarios
  finales más allá de los ids efímeros.

---

## 13. Constantes

```ts
export const DEFAULT_ENDPOINT = "https://api.trell.dev/v1/events";
export const MAX_BATCH = 10;
export const MAX_BATCH_INTERVAL_MS = 5_000;
export const MAX_PAYLOAD_BYTES = 64 * 1024;
export const MAX_PROPERTY_BYTES = 4 * 1024;
export const MAX_QUEUE = 100;
export const SESSION_IDLE_MS = 30 * 60 * 1000;
export const COOKIE_VISITOR = "trell:vid";
export const STORAGE_SESSION = "trell:sid";
export const STORAGE_UTM = "trell:utm";
```

---

## 14. Micro-decisiones (RESUELTAS)

1. **Éxito** → ambas vías (`form().success()` y `track("form_success")`) son
   válidas y equivalentes.
2. **Naming de campos** → `field_interaction` con `interaction: "focus" | "change"`.
3. **identify()** → el SDK recibe el identificador crudo y hashea SHA-256 por
   dentro; nunca transmite PII cruda (ver Decision log Prompt 09).
4. **Transporte** → valores de §13 aprobados (batch 10 / 5s / 64KB / 4KB prop / 100 cola).

> **El contrato del SDK está CONGELADO.** Cualquier cambio futuro necesita un
> prompt explícito (evolución de schema v1).

**Decision log (Prompt 09):** cambios contractuales, documentados y aplicados aquí:
- §2.4 / §8.3 — `identify({ userId?, email? })` recibe el identificador **crudo**,
  el SDK calcula SHA-256 y **solo envía el hash**; nunca transmite PII cruda
  (sustituye al ejemplo previo con `emailHash` pre-calculado). Hash **síncrono**
  (JS puro, determinista en cualquier entorno).
- §2.3 — `form().destroy()` pasa a ser **funcional** (limpieza de listeners,
  observers, timers y estado; re-inicialización segura sin duplicar eventos).
- El resto del contrato permanece intacto.

---

## 15. DEFINIR en Prompt 02 (checklist cumplido)

- [x] firma de `init()`
- [x] configuración
- [x] API pública (mínima)
- [x] cómo se identifica un proyecto
- [x] cómo se identifica un formulario
- [x] cómo se detecta un submit
- [x] eventos automáticos
- [x] eventos manuales
- [x] estructura JSON
- [x] timestamps
- [x] session ID
- [x] anonymous ID
- [x] UTM parameters
- [x] URL/referrer
- [x] device/browser
- [x] validación
- [x] retries
- [x] batching
- [x] sendBeacon
- [x] comportamiento offline
- [x] tamaño máximo del payload
- [x] errores
- [x] privacidad
