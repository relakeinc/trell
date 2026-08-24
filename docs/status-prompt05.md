# Trell — Prompt 05 · Estado de implementación

> **Analytics backend.** API de management/analytics auth-skle
> (`@trell/shared/models metrics single-source-of-truth`) listo para la UI.
> `docs/sdk-contract.md` intacto. Handoff previo: `docs/status-prompt04.md`.

---

## 1. Qué se implementó

### Endpoints privados (auth `sk`, nunca `pk`)
- `GET /v1/projects/:id/stats?from&to&type` → resumen de métricas.
- `GET /v1/projects/:id/series?interval=hour|day|week&from&to&type` → serie temporal
  para gráficas (buckets + sesiones/visitantes por bucket).
- `GET /v1/projects/:id/breakdown?dimension=page|utm_source|utm_medium|utm_campaign|device|browser|os|form|type&limit` → top dimensiones (con %).
- `GET /v1/projects/:id/forms` → formularios derivados de los eventos (id, nombre, eventos, success, conversionRate).
- `GET /v1/projects/:id/events?limit&from&to&type` → eventos crudos (detalle).

### Métricas (single source of truth, `src/analytics/metrics.ts`)
Definición explícita — esto es lo importante antes de la UI:

| Métrica | Definición |
|---------|-----------|
| `views` | count `form_view` |
| `starts` | count `form_start` |
| `submits` | count `form_submit` |
| `successes` | count `form_success` |
| `abandons` | count `form_abandon` |
| `ctaClicks` | count `cta_click` |
| `fieldInteractions` | count `field_interaction` |
| `sessions` | distinct `session_id` |
| `visitors` | distinct `visitor_id` |
| `conversionRate` | `successes / views` (null si views=0) |
| `startConversionRate` | `successes / starts` (null si starts=0) |
| `avgTimeToCompleteMs` | avg(`success.ts − start.ts`) por `(session_id, form_id)`, solo grupos con ambos |

- `computeMetrics` / `computeSeries` / `computeBreakdown` son **funciones puras**
  sobre `StoredEvent[]`; repos solo filtran (fecha/tipo empujados a la query).
- Filtros: `from`/`to` (ISO), `type` (comma-separada). `interval` y `dimension`
  validados (invalid → `400`).

### Autenticación `sk`
- `skAuth` (middleware) valida la clave secreta **contra el hash** del proyecto
  (se pasa el id en la ruta). `sk` **nunca** viaja al SDK ni se usa en ingestion.
- `pk` sigue siendo solo para `POST /v1/events`. Separación pública/privada clara.

### Modelo / repositorios
- Añadido `formId`/`formName` a `Event` (schema Prisma + `StoredEvent`) + índice
  `(projectId, formId, ts)`. Mejora la consultabilidad para breakdowns de formularios.
- `Repo` + `MemoryRepo` (tests) + `PrismaRepo`: `findProjectById`, `getEventsForAnalytics`
  (filtro fecha/tipo), `insertEvents` (idempotente).

---

## 2. Tests
- **API: 42** — incluye `metrics.test.ts` (8: conteos, conversión, avg time, series/day,
  breakdown/utm/form, buildFilter) y `analytics.test.ts` (9: rechazo pk, clave sk inválida,
  404, stats, series, breakdown, forms, dimension/interval inválidos).
- **SDK: 32** (sin cambios, siguen verdes).
- **Total: 74 tests verdes.** Build ✓ · Typecheck ✓.

---

## 3. Qué falta (siguiente paso)
- **Prompt 06 — Dashboard UI** mínimo sobre estos endpoints (subirán la confianza de
  que las métricas tienen sentido).
- **Rollups / agregaciones** (`DailyStats`/`HourlyStats`) cuando el volumen lo exija.
  De momento **no** se agregó rollup prematuro: las queries van directas a `Event`.
- Redis para rate limit a escala; `docker-compose` self-host; migrar Prisma a
  `packages/db`.
- Las 3 desviaciones del SDK siguen abiertas (bundle, `form().destroy()`,
  semántica de `identify`).

---

## 4. Notas / decisiones
1. **Conversión**: `conversionRate` = `successes/views` (cuántos de los que vieron el
   form lo completaron) y, además, `startConversionRate` = `successes/starts`
   (cuántos de los que empezaron lo terminan). La UI puede mostrar ambas.
2. **Agregación en memoria al vuelo** sobre los eventos filtrados (una única definición
   de métricas). Si crece, se migra la lógica a SQL/rollups manteniendo la definición.
3. `formId` derivado del envelope; formularios que aún no se registran explícitamente ya
   aparecen en `/forms` a partir de los eventos.
