# Trell MCP — Auth

Capas (de fuera hacia dentro):

1. **Transporte HTTP**: `Authorization: Bearer <MCP_API_KEY>`.
   Sin key configurada (`MCP_API_KEY` vacío) el endpoint responde `503` a todo
   (fail-closed). Key incorrecta → `401`. Comparación con `timingSafeEqual`.
2. **Workspaces**: `MCP_ALLOWED_SLUGS=*` (todos) o lista `slug1,slug2`.
   Cada tool resuelve el workspace por slug o id y rechaza con
   `project_forbidden` lo que esté fuera de la lista.
3. **Destructivas** (Fase 3): `MCP_ALLOW_DESTRUCTIVE=true` + argumento
   `confirm: true` en la llamada. Sin ambos → error.

Secretos que el MCP **jamás** devuelve ni loguea:

- `sk_...` (secretos de API Keys): solo metadata (`name`, `keyPrefix`, fecha).
- Signing secrets de webhooks.
- Hashes (`apiKeyHash`, `keyHash`).
- `DATABASE_URL`, `MCP_API_KEY`, `TRELL_*` del entorno.

La `pk_...` **sí** se devuelve (`get_project`, `tracking_checkup`): es pública
por diseño (viaja en el snippet del navegador).

Transporte stdio: sin auth (proceso local del usuario, como Claude Desktop).
