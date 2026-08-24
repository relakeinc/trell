# Trell — Prompt 11 · Estado de implementación

> **Product polish + product language.** De sistema funcional a producto usable.
> `docs/sdk-contract.md` intacto. Handoff: `status-prompt10.md`.

---

## 1. Product language (nuevo módulo)
`apps/web/src/lib/labels.ts` — cómo Trell habla con el usuario:
- Eventos internos → labels amigables: `form_view→Form views`, `form_start→Form starts`,
  `form_submit→Submissions`, `form_success→Conversions`, `form_abandon→Abandonments`,
  `field_interaction→Field interactions`, `cta_click→CTA clicks`.
- Métricas → `conversionRate→"Conversion rate"`, `startConversionRate→"Completion after start"`, etc.
- **Explicaciones contextuales** (tooltips) para las dos métricas "de conversión":
  - `Conversion rate`: *Conversions ÷ form views — de quienes vieron tu form, cuántos lo completaron.*
  - `Completion after start`: *Conversions ÷ form starts — de quienes empezaron, cuántos terminaron.*
- Los nombres técnicos solo se muestran donde aportan (p.ej. logs/raw).

## 2. Dashboard (polish)
- **Jerarquía visual** y **responsive** (sidebar oculta en mobile, grids adaptables).
- **Loading skeleton** y **estados empty/error** por sección.
- **Tooltips/explicaciones** en las KPI (sobre todo Conversion y Completion after start).
- **Nombres comprensibles** (product language) en KPIs, funnel y eventos recientes.
- **Fechas** formateadas de forma consistente (locale + relativo "X ago").
- **Primera experiencia** (clave):
  - Sin datos: *"No events yet — Install Trell on your website and we'll start showing your
    visitor and form analytics here."* + **[View installation guide]**.
  - Con datos: *"Your project is connected ✓ — we're receiving events from
    <dominio>. (Last event X ago.)"*.
- Selector de proyecto + filtros (rango/intervalo/form) + new project persistidos.

## 3. Project settings (coherente)
Secciones ordenadas: **Connection status** · **Setup/onboarding por pasos** ·
**API credentials** (pk copiable + **Rotate secret key**, solo owner, con confirmación y
advertencia; la nueva `sk` se muestra una vez; la antigua se invalida al instante) ·
**Install SDK** (snippet copiable) · **Allowed domains** (editor con validación) ·
**Nota de seguridad** (la `sk` nunca llega al navegador; se guarda solo el hash).

## 4. Backend (nuevo)
- `POST /api/projects/[id]/rotate-secret` — **solo owner** (`roleOf`), genera nueva `sk`,
  actualiza `apiKeyHash` + `apiKeyEncrypted`, devuelve la `sk` una vez.
- `ProjectAccessService.roleOf(projectId, userId)` añadido.

---

## 5. Validación
- `pnpm build` ✓ (incl. `next build`) · `pnpm typecheck` ✓.
- **107 tests** (SDK 40 · API 50 · web **17** — añadidos `labels` y `roleOf`).
- **E2E 22/22** (añadido rotate: nueva sk 200, antigua 401).

## 6. Fuera de alcance (por diseño)
Jira/Slack/Notion · webhooks · billing · equipos avanzados · AI · alertas · rollups ·
nuevas fuentes de datos. Primero: instalar → recibir datos → entender qué pasa.

---

## 7. Resumen
Producto usable: onboarding guiado + dashboard con métricas claras y explicadas +
settings coherentes (credenciales, allowlist, SDK, estado) + primera experiencia con
estado visible ("no events yet" ⇄ "connected ✓") + product language consistente.
