# Trell MCP — Auth

Dos modos. El Bearer decide cuál:

## 1. OAuth por usuario (personas, recomendado)

Login con Google (mismo cliente OAuth que el dashboard). Flujo estándar:

```
editor → POST /register (DCR) → GET /authorize → 302 Google
→ login → GET /oauth/callback → 302 editor?code=… → POST /token (PKCE S256)
→ access_token (12h) + refresh_token (30d)
```

- Sin estado en servidor: DCR acepta loopback/`vscode.dev`; el `state` y el
  `code` son JWT firmados (10 min). Sin tablas nuevas.
- El `access_token` lleva el **email** → las tools resuelven el usuario real
  y filtran por sus **membresías** (`owner`/`member`). Sin membresía no se ve
  nada (`project_forbidden`), aunque se adivine el slug.
- `MCP_ALLOWED_EMAILS` (opcional): solo esos emails pueden loguearse. Vacío =
  cualquier Google verificado (igual que el signup del dashboard).
- Rotar `MCP_OAUTH_SECRET` invalida todos los tokens de golpe.

## 2. Service key (bots, legacy)

`Authorization: Bearer <MCP_API_KEY>` → modo servicio, sin identidad:
alcance = `MCP_ALLOWED_SLUGS`. Para backends sin navegador.

## Discovery

- `GET /.well-known/oauth-protected-resource` y
  `/.well-known/oauth-authorization-server` (RFC 9728): para que los editores
  hagan el flujo correcto en vez de adivinar.
- Sin Bearer (o malo) en `POST /` → `403` (nunca `401`: los editores
  auto-inician OAuth ante un 401 y aquí el Bearer fijo es legítimo).
- Sin `MCP_API_KEY` y sin token → `503` en modo discovery; `POST /` con JWT
  válido funciona incluso sin `MCP_API_KEY` (OAuth puro).

## Secretos que el MCP jamás devuelve ni loguea

`sk_...`, signing secrets de webhooks, hashes, `DATABASE_URL`,
`MCP_API_KEY`, `MCP_OAUTH_SECRET`, `GOOGLE_CLIENT_SECRET`.
La `pk_...` **sí** se devuelve (pública por diseño).

Transporte stdio: sin auth (proceso local del usuario, como Claude Desktop).

## Variables

| Var | Uso |
|-----|-----|
| `MCP_API_KEY` | Bearer servicio/bots. Vacío = endpoint solo-OAuth |
| `MCP_PUBLIC_URL` | issuer/base (def. `https://mcp.relake.co`) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | mismo cliente que el dashboard; sin ellas el login da `503` |
| `MCP_OAUTH_SECRET` | firma de codes/tokens (def: `MCP_API_KEY`) |
| `MCP_ALLOWED_SLUGS` | filtro extra (`*` = todos) |
| `MCP_ALLOWED_EMAILS` | login restringido (vacío = cualquiera verificado) |
| `MCP_ALLOW_DESTRUCTIVE` | destructivas (Fase 3) |
