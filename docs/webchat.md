# Ask Trell — webchat del dashboard

Widget flotante en los workspaces (`[slug]`), potenciado por OpenRouter
(modelos `:free`) y las 28 tools del MCP. Sin infra nueva: corre en el
contenedor `web`, sin GPU ni RAM extra en el VPS.

## Cómo funciona

1. Usuario logueado (Auth.js) abre cualquier workspace → widget abajo-derecha.
2. `POST /api/chat` (401 sin sesión): el backend firma un JWT de identidad
   (15 min, `MCP_OAUTH_SECRET`) con el email de la sesión y abre cliente MCP
   contra `MCP_URL` → las tools devuelven **solo sus proyectos**.
3. Loop agente OpenAI-compatible (máx. 6 turnos, streaming SSE) contra
   `OPENROUTER_BASE_URL`: el modelo llama tools, el backend las ejecuta y
   stremea la respuesta final. Eventos SSE: `text` (respuesta), `thought`
   (razonamiento del modelo, solo si el modelo lo emite), `status`,
   `tool` (chips con input/output), `done`, `error`.
4. Destructivas exigen confirmación en lenguaje natural antes de llamarlas
   (la tool además pide `confirm: true`).
5. Reasoning: se pide `reasoning: { effort: "medium" }` y los deltas
   `reasoning`/`reasoning_content` se muestran en un bloque colapsable
   "Reasoning…" + shimmer "Thinking…" mientras no hay texto. Si el
   proveedor rechaza el parámetro (400), reintenta una vez sin él. Los
   modelos `:free` pequeños a veces no razonan: entonces no hay bloque.
6. Resiliencia free tier: ante 429/402/404 reintenta una vez con el
   fallback y enfría el primario (10 min tras 429, 60 min tras 404) para
   no pagar el intento condenado en cada mensaje. Las declarations de
   tools se cachean 5 min. Límites típicos `:free`: ~20 req/min, 200/día.

## Variables (servicio `web`)

| Var | Uso |
|-----|-----|
| `OPENROUTER_API_KEY` | OpenRouter. Sin ella `/api/chat` da `503` |
| `OPENROUTER_MODEL` | def. `openrouter/free` (router: elige free con tool-calling) |
| `OPENROUTER_FALLBACK_MODEL` | def. `meta-llama/llama-3.2-3b-instruct:free` (entra si el primario da 429/402/404) |
| `OPENROUTER_BASE_URL` | def. `https://openrouter.ai/api/v1` |
| `MCP_OAUTH_SECRET` | mismo valor que el stack MCP (firma JWT identidad) |
| `MCP_URL` | def. `http://api:8788`; en prod apunta al stack MCP (`http://trell-mcp-mcp-1:8788`) |

## Notas

- La key de OpenRouter vive solo en `apps/web/.env` (ignorado por git).
  Como se compartió por chat, conviene rotarla en openrouter.ai/keys
  cuando se quiera (actualizar `.env` + restart web).
- Límite free tier de OpenRouter (~20 req/min, 200 req/día por modelo):
  sobrado para uso personal; si se satura, el widget muestra el error tal cual.
