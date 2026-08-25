# SDK: Scroll Depth & Time on Page

## Descripción
El SDK actual trackea pageviews, forms y CTA clicks. Falta capturar métricas de engagement: cuánto tiempo pasa el usuario en la página y hasta dónde scrollea.

## Funcionalidades

### Scroll Depth
- Trackear el % máximo de scroll (0-100%) por página
- Enviar evento `scroll_depth` cuando se alcanzan milestones: 25%, 50%, 75%, 100%
- Incluir `page_path` y `page_title`
- Usar IntersectionObserver o scroll listener con throttle

### Time on Page
- Trackear tiempo total en la página antes de navigate away
- Enviar evento `page_exit` con `durationMs`
- Usar `beforeunload` + `visibilitychange` para capturar salida
- Calcular desde el pageview hasta la salida

## Event Schema
```json
{
  "type": "scroll_depth",
  "properties": { "depth": 75, "maxDepth": 100 }
}

{
  "type": "page_exit",
  "properties": { "durationMs": 45200, "maxScrollDepth": 62 }
}
```

## Analytics Impact
- Nuevos KPIs: Avg Scroll Depth, Avg Time on Page
- Nuevo gráfico: Scroll distribution (buckets: 0-25%, 25-50%, 50-75%, 75-100%)
- Breakdown por página

## Archivos a modificar
- `apps/api/public/trell.js` — agregar scroll tracking + time on page
- `apps/api/src/analytics/metrics.ts` — agregar scroll_depth y page_exit al computeMetrics
- `apps/web/src/app/[slug]/analytics/page.tsx` — mostrar nuevos KPIs
- `packages/shared/src/schemas.ts` — agregar schemas de nuevos eventos
