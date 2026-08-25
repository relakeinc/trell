# Webhook Delivery System

## Descripción
Los webhooks ya se pueden crear y guardar en la DB, pero no se entregan. Falta implementar el sistema de delivery que envía POST requests a las URLs configuradas cuando ocurren eventos.

## Funcionalidades
- **Delivery async**: enviar webhooks después del ingest, sin bloquear
- **Retry con backoff**: 3 intentos con delay exponencial (1s, 5s, 30s)
- **Signing secret**: firmar el payload con HMAC-SHA256 usando el `secret` del webhook
- **Event filtering**: solo enviar los eventos que el webhook tiene en su array `events`
- **Delivery log**: registrar éxitos/fallos en una tabla para debugging
- **Rate limiting**: max 10 webhooks por evento, max 1 request/segundo por webhook

## Payload Format
```json
{
  "event": "form_submit",
  "timestamp": "2026-08-25T03:02:02Z",
  "project_id": "7443bc5d-...",
  "data": {
    "form_id": "contact-form",
    "page": "/pricing",
    "fields": { "name": "John", "email": "john@..." },
    "visitor_id": "abc-123",
    "session_id": "def-456"
  }
}
```

## Headers
```
Content-Type: application/json
X-Trell-Signature: sha256=...
X-Trell-Event: form_submit
X-Trell-Delivery: uuid
```

## Schema (Delivery Log)
```prisma
model WebhookDelivery {
  id          String   @id @default(uuid()) @db.Uuid
  webhookId   String   @db.Uuid
  webhook     Webhook  @relation(fields: [webhookId], references: [id], onDelete: Cascade)
  event       String
  status      String   // "pending" | "success" | "failed"
  statusCode  Int?
  response    String?  @db.Text
  attempts    Int      @default(0)
  nextRetryAt DateTime?
  createdAt   DateTime @default(now())

  @@index([webhookId, createdAt])
}
```

## Archivos a crear/modificar
- `apps/api/prisma/schema.prisma` — agregar WebhookDelivery
- `apps/api/src/lib/webhook-delivery.ts` — lógica de delivery + retry
- `apps/api/src/routes/ingest.ts` — disparar webhooks después de insertar eventos
- `apps/web/src/app/api/projects/[id]/webhooks/route.ts` — agregar delivery log endpoint
- `apps/web/src/app/[slug]/settings/webhooks/page.tsx` — mostrar delivery log
