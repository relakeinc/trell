# Trell MCP — Tools (Fase 1 + 2, solo lectura)

Todas las tools reciben `project` (slug o id del workspace) salvo
`list_projects`. Respuestas en JSON dentro de `content[0].text`.
Errores: `{ error: { code, message } }` con `isError: true`.

Códigos: `project_not_found` · `project_forbidden` (fuera de
`MCP_ALLOWED_SLUGS`, fuera de tus membresías, login no permitido o sin cuenta
Trell) · `invalid_input` · `destructive_disabled` ·
`confirm_required` · `internal_error`.

Convenciones: fechas ISO, rangos por defecto últimos 30 días (forms: 90),
rango máximo 366 días, `limit` con tope 100.

## Proyectos

| Tool | Args | Devuelve |
|------|------|----------|
| `list_projects` | — | `[{ id, slug, name, plan }]` (respeta allowlist) |
| `get_project` | `project` | `id, slug, name, plan, pk` (publicable, es pública), `domains[]`, `createdAt` |
| `tracking_checkup` | `project` | `connected`, `lastEventAt`, `totalEvents`, `domains`, `pk`, `findings[]` (avisa si no hay eventos o la allowlist está vacía) |

## Analytics

| Tool | Args | Devuelve |
|------|------|----------|
| `get_stats` | `project`, `from?`, `to?`, `type?` | `total`, `byType`, `topForms[5]`, `topPages[5]` |
| `get_series` | + `interval` (`hour`\|`day`\|`week`, def. `day`), `form?` | `series: [{ bucket, count }]` con huecos rellenados a 0 |
| `get_breakdown` | + `dimension` (`page`\|`utm_source`\|`utm_medium`\|`utm_campaign`\|`device`\|`browser`\|`os`\|`form`\|`type`, def. `page`), `limit?` (def. 25) | `rows: [{ value, count }]` |
| `get_forms` | `project`, `from?`, `to?` | `[{ id, name, events, starts, successes, conversionRate }]` (`successes/starts`, definición del dashboard) |
| `query_events` | + `limit?` (def. 25), `cursor?` (eventId) | eventos (más recientes primero), `total`, `nextCursor` |

## Catálogo

| Tool | Args | Devuelve |
|------|------|----------|
| `list_funnels` / `get_funnel` | `project` / + `funnel` (id o nombre) | definiciones con pasos (`eventType`, `formId`, `label`, `position`) |
| `list_views` | `project` | `[{ id, name, type, createdAt }]` |
| `list_webhooks` | `project` | `[{ id, url, events, enabled, createdAt }]` — el secret de firma **nunca** se expone |
| `list_utm_templates` | `project` | todos los campos UTM |
| `list_api_keys` | `project` | `[{ id, name, keyPrefix, createdAt }]` — hashes y secretos **nunca** se exponen |

## Resources

| URI | Contenido |
|-----|-----------|
| `trell://projects` | como `list_projects` |
| `trell://projects/{slug}/usage` | `plan`, `eventsLast30d`, `domainsUsed` (template, no se lista) |
| `trell://schema/events` | envelope de evento server-side válido |

## Prompts

| Prompt | Args | Uso |
|--------|------|-----|
| `weekly_report` | `project` | guía al asistente: checkup → stats 7d vs 7d previos → forms → breakdown pages |
| `tracking_setup_help` | — | checklist de verificación de instalación |

## Escrituras (miembro del workspace)

Requieren membresía (cualquier rol; modo servicio = operador). Dominios se
normalizan (`HTTPS://X.com/path/` → `x.com`, se valida hostname).

| Tool | Args | Devuelve |
|------|------|----------|
| `create_funnel` | `project`, `name`, `steps[{eventType, formId?, label?}]` (1–10) | `{ id, name }` |
| `update_funnel` | `project`, `funnel` (id), `name?`, `steps?` (reemplazo total) | `{ id, name }` |
| `delete_funnel` | `project`, `funnel` (id) | `{ deleted }` |
| `create_utm_template` | `project`, `name`, campos UTM opcionales | `{ id, name }` |
| `update_utm_template` | `project`, `template` (id), campos | `{ id, name }` |
| `delete_utm_template` | `project`, `template` (id) | `{ deleted }` |
| `add_domain` | `project`, `domain` (idempotente) | `{ domains[] }` |
| `remove_domain` | `project`, `domain` | `{ domains[] }` |
| `create_webhook` | `project`, `url` (http/https, sin credenciales ni IPs privadas), `events[]` | `{ id, url, events }` |
| `delete_webhook` | `project`, `webhook` (id) | `{ deleted }` |
| `create_api_key` | `project`, `name` | `{ id, name }` + `secret` **una sola vez** (guardar en `.env`, jamás en el navegador) |

## Destructivas (owner + `MCP_ALLOW_DESTRUCTIVE=true` + `confirm: true`)

Sin los tres requisitos responden `destructive_disabled` o `confirm_required`.

| Tool | Efecto |
|------|--------|
| `revoke_api_key` | revoca una server key al instante (rompe integraciones que la usen) |
| `delete_project` | borra el workspace y todo (eventos, keys, webhooks…) en cascada |
| `rotate_project_secret` | nueva `sk` (muestra el secreto una vez); la anterior muere al instante; las named keys no se tocan |

## Notas

- **Identidad**: con Bearer OAuth, `list_projects` devuelve solo tus
  workspaces (membresías) y el resto de tools rechaza lo ajeno. Con la
  service key (`MCP_API_KEY`) no hay scoping por usuario (ver `AUTH.md`).
- `query_events` ordena por `ts` ascendente internamente para que el cursor sea
  determinista aunque el store no garantice orden.
- Escrituras y destructivas: Fase 3 (ver `docs/mcp-plan.md`).
