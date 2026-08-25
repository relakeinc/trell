# Analytics: Real-time Dashboard & More Metrics

## Descripción
Mejorar el dashboard de analytics con más métricas, visualizaciones y un modo real-time.

## Funcionalidades

### Real-time Panel
- Mostrar eventos de los últimos 30 segundos en vivo
- Polling cada 3s o SSE (Server-Sent Events)
- Counter animado de "events in the last 30s"
- Últimos 10 eventos con timestamp relativo ("2s ago")

### Nuevos KPIs
- **Unique Visitors** (visitor_id distinct)
- **Sessions** (session_id distinct)
- **Bounce Rate** (sessions with only 1 pageview)
- **Pages per Session** (avg pageviews / sessions)

### Nuevos Gráficos
- **Device breakdown** (pie chart: desktop/mobile/tablet)
- **Browser breakdown** (bar chart)
- **Top Pages** (table con page path + views)
- **Referrer breakdown** (top referrers)

### Comparison Mejorado
- Comparar 2 rangos de fechas side-by-side
- Mostrar % change entre periodos
- Highlight verde/rojo para improvement/regression

## Archivos a modificar
- `apps/api/src/routes/analytics.ts` — nuevos endpoints (realtime, bounce rate, etc.)
- `apps/api/src/analytics/metrics.ts` — agregar métricas
- `apps/web/src/app/[slug]/analytics/page.tsx` — nuevos panels
- `apps/web/src/app/[slug]/comparison/page.tsx` — comparación side-by-side
- Nuevo componente: `RealtimePanel.tsx`
