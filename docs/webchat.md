# Ask Trell — webchat del dashboard

Widget flotante en los workspaces (`[slug]`), potenciado por Gemini gratis
(AI Studio) y las 28 tools del MCP. Sin infra nueva: corre en el contenedor
`web`, sin GPU ni RAM extra en el VPS.

## Cómo funciona

1. Usuario logueado (Auth.js) abre cualquier workspace → widget abajo-derecha.
2. `POST /api/chat` (401 sin sesión): el backend firma un JWT de identidad
   (15 min, `MCP_OAUTH_SECRET`) con el email de la sesión y abre cliente MCP
   contra `MCP_URL` → las tools devuelven **solo sus proyectos**.
3. Loop agente (máx. 6 turnos, streaming SSE): Gemini 2.5 Flash llama tools,
   el backend las ejecuta y stremea la respuesta final. Eventos SSE:
   `text` (respuesta), `thought` (razonamiento del modelo), `status`,
   `tool` (chips), `done`, `error`.
4. Destructivas exigen confirmación en lenguaje natural antes de llamarlas
   (la tool además pide `confirm: true`).
5. Reasoning: el backend pide `thinkingConfig: { includeThoughts: true }`
   y extrae partes con `thought: true` a mano (el `.text` del SDK puede
   incluirlas o no según versión). El widget muestra un bloque colapsable
   "Reasoning…" sobre la respuesta + shimmer "Thinking…" mientras no hay
   texto. Si el modelo rechaza thinking, reintenta una vez sin él. El
   razonamiento no se persiste en el historial (`localStorage`).

## Variables (servicio `web`)

| Var | Uso |
|-----|-----|
| `GEMINI_API_KEY` | AI Studio (gratis). Sin ella `/api/chat` da `503` |
| `GEMINI_MODEL` | def. `gemini-3.5-flash` (capaz + gratis, ~20 req/día) |
| `GEMINI_FALLBACK_MODEL` | def. `gemini-3.5-flash-lite` (gratis, ~500 req/día; entra solo si el principal da 404/429) |
| `MCP_OAUTH_SECRET` | mismo valor que el stack MCP (firma JWT identidad) |
| `MCP_URL` | def. `http://api:8788`; en prod apunta al stack MCP (`http://trell-mcp-mcp-1:8788`) |

## Notas

- La key de Gemini quedó expuesta en el chat al instalarla: se puede rotar
  en AI Studio en cualquier momento (actualizar `/opt/trell/.env` + restart web).
- Límite free tier de Gemini: sobrado para uso personal; si se satura, el
  widget muestra el error tal cual.
