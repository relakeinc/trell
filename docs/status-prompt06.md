# Trell — Prompt 06 · Estado de implementación

> **Dashboard mínimo de VALIDACIÓN** + datos sintéticos para verificar que las
> métricas tienen sentido antes de construir la UI real.
> `docs/sdk-contract.md` intacto. Handoff previo: `docs/status-prompt05.md`.

---

## 1. Qué se implementó

### Dashboard dev (`apps/api/src/dashboard.ts`) — servido en `GET /`
Un único HTML autocontenido (vanilla JS, sin framework) servido **same-origin**
desde la API (así no hay CORS). Muestra:
- **Selector**: project id, `sk`, rango de fechas (default: últimos 30 días),
  **form id opcional**, intervalo.
- **KPIs**: Views, Starts, Submits, Successes, Abandons, Conversion, Start conv.,
  Sessions, Visitors, Avg time.
- **Funnel**: Views → Starts → Submits → Successes (barras).
- **Serie temporal** (day/week/hour) por Views/Successes.
- **Breakdowns**: page, utm_source, utm_medium, device, browser, os.
- **Formularios** (tabla con eventos/success/conversión por formulario).
- **Eventos recientes** (últimos 25).

> **Caveat de auth:** la `sk` se introduce para mostrar y se guarda en
> `localStorage`. Es un mecanismo **provisional de desarrollo**. **No** es el
> modelo de autenticación definitivo (Prompt 07). Se señala en la propia UI.

### Filtro `form` (nuevo, no métrica)
Añadido `?form=<id>` a `/stats`, `/series`, `/breakdown`, `/events` y al
`AnalyticsFilter` para poder aislar un formulario concreto. Permite verificar el
escenario exacto de un form sin mezclarlo con otros. (Es un filtro, no una métrica
nueva.)

### Datos sintéticos (`src/dev/synthetic.ts`)
- `TRELL_DEV_SEED=1` al arrancar el server → siembra y loguea `project id`, `sk`, `pk`.
- `pnpm db:seed:events` → CLI equivalente (usa `DATABASE_URL` si existe, si no, memoria).
- Incluye **Form A** (100 views / 60 starts / 40 submits / 25 success / 15 abandons)
  y **bordes**: form B sin success; un `event_id` duplicado; unos eventos fuera del
  rango de 30 días.

---

## 2. Validación (evidencia)

Con `form=form-a` + rango 30 días (lo que verá el dashboard al aislar el form):

| Métrica | Valor mostrado | Esperado |
|---------|----------------|----------|
| views | 100 | 100 |
| starts | 60 | 60 |
| submits | 40 | 40 |
| successes | 25 | 25 |
| abandons | 15 | 15 |
| **conversionRate** | **25.00%** | 25% |
| **startConversionRate** | **41.67%** | 41.67% |
| **avgTimeToCompleteMs** | **10000** | 10s |

Casos borde verificados (tests `scenarios.test.ts` + `metrics.test.ts`):
- sesiones repetidas **no inflan** visitantes (visitors=1, sessions=3);
- un `event_id` repetido **no duplica** métricas;
- eventos fuera de rango **no aparecen** (filtro `from`);
- `week` produce buckets consistentes;
- un formulario sin ningún success **no rompe** las métricas;
- `avgTimeToCompleteMs` **ignora** sesiones incompletas;
- breakdowns **suman coherentemente** (Σ counts = total eventos).

---

## 3. Estado
- `pnpm build` ✓ · `pnpm typecheck` ✓ · `pnpm test` → **82 tests verdes**
  (50 API + 32 SDK).
- Dashboard se sirve en `GET /` (verificado OK), stats con seed en proceso
  arrojan exactamente 25%/41.67%/10s.

---

## 4. Semántica observada (para decidir en Prompt 07)
1. `conversionRate` (successes/views) vs `startConversionRate` (successes/starts)
   **ambos útiles**: si hay muchas vistas pero pocos starts, `conversionRate` baja
   y `startConversionRate` sube. El dashboard muestra ambos (recomendado).
2. `avgTimeToComplete` se mide **desde `form_start` hasta `form_success`** (no
   cuenta el tiempo en página antes de empezar) — razonable, pero conviene
   documentarlo.
3. Un formulario con muchas vistas y pocos starts (gente que solo aterriza)
   infla la "view" y deprime la conversión — definir el "success" por sesión+form
   es lo que evita dobles conteos.

---

## 5. Qué sigue (Prompt 07)
- **Endurecer el modelo de auth del dashboard**: NO exponer `sk` en una web pública.
  Opciones: dashboard como app Next.js con Auth.js (sesiones) que usa `sk` en el
  backend, o tokens cortos emitidos desde el backend. Documentar cuál se adopta.
- Empezar a "convertir esto en producto": onboarding de proyectos, clarificación
  de métricas en la UI ("qué significa cada una"), y revisión del flag `sk` en el
  dashboard (que quede detrás de un auth real).
- Rollups/optimización de queries siguen **fuera** (no se tocaron).
