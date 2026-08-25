# Email Notifications para Form Submissions

## Descripción
Cuando un usuario envía un formulario en el sitio del cliente, enviar un email de notificación al owner del proyecto de Trell con los datos del formulario.

## Funcionalidades
- **Toggle de notificaciones**: activar/desactivar por proyecto en Settings > Notifications
- **Email destino**: configurar email donde recibir las notificaciones
- **Formato del email**: nombre del form, campos rellenados, timestamp, página
- **Rate limiting**: max 1 email por minuto por proyecto (agrupar submissions)
- **Template del email**: HTML limpio con branding de Trell

## Email Template (ejemplo)
```
📋 New Form Submission — Trell

Project: Out
Form: contact-form
Page: /pricing
Time: Aug 25, 2026 at 3:02 AM

Fields:
  name: John Doe
  email: john@example.com
  message: Interested in pro plan

---
Powered by Trell
```

## Schema
```prisma
model NotificationSetting {
  id          String   @id @default(uuid()) @db.Uuid
  projectId   String   @db.Uuid
  project     Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  type        String   // "form_submission"
  enabled     Boolean  @default(false)
  email       String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@unique([projectId, type])
}
```

## Implementation Notes
- Usar un email provider (Resend, SendGrid, o el SMTP nativo de Node)
- Queue de emails con retry en background (no bloquear el ingest)
- Unsubscribe link en el email
- Headers del email: From = notifications@trell.relake.co
- Guardar setting en la página de Settings > Notifications (nueva pestaña)

## Archivos a crear/modificar
- `apps/api/prisma/schema.prisma` — agregar NotificationSetting
- `apps/api/src/routes/ingest.ts` — disparar email después de form_submit (async)
- `apps/web/src/app/[slug]/settings/notifications/page.tsx` — UI
- `apps/web/src/components/ProjectSidebar.tsx` — agregar link
- Nuevo paquete: `packages/email/` o integración con Resend
