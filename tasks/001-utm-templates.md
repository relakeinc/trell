# UTM Templates

## Descripción
Crear un sistema de plantillas UTM类似于 Dub.co (app.dub.co/chenii/links/utm). Permite a los usuarios guardar combinaciones frecuentes de parámetros UTM para reutilizarlas al crear links de tracking.

## Funcionalidades
- **Crear template**: nombre + parámetros (source, medium, campaign, term, content, referral)
- **Listar templates**: tabla con todos los templates guardados
- **Editar template**: modificar cualquier parámetro
- **Eliminar template**: borrar con confirmación
- **Aplicar template**: autollenar los campos UTM al crear un link o campaña

## UI (referencia Dub.co)
```
┌─────────────────────────────┐
│  Create UTM Template        │
│                             │
│  Template Name              │
│  [________________]         │
│                             │
│  Parameters                 │
│  🌐 Source    [google    ]  │
│  📢 Medium    [cpc       ]  │
│  🏷  Campaign  [summer sale] │
│  🔍 Term      [running sh.] │
│  📄 Content   [logo link  ] │
│  🔗 Referral  [yoursite.c]  │
│                             │
│       [Create template]     │
└─────────────────────────────┘
```

## Schema (Prisma)
```prisma
model UtmTemplate {
  id          String   @id @default(uuid()) @db.Uuid
  projectId   String   @db.Uuid
  project     Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  name        String
  source      String?
  medium      String?
  campaign    String?
  term        String?
  content     String?
  referral    String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([projectId])
}
```

## API Routes
- `GET    /api/projects/[id]/utm-templates` — listar
- `POST   /api/projects/[id]/utm-templates` — crear
- `PATCH  /api/projects/[id]/utm-templates/[tid]` — actualizar
- `DELETE /api/projects/[id]/utm-templates/[tid]` — eliminar

## Archivos a crear/modificar
- `apps/api/prisma/schema.prisma` — agregar modelo UtmTemplate
- `apps/api/prisma/migrations/` — migración
- `apps/web/src/app/api/projects/[id]/utm-templates/route.ts` — GET + POST
- `apps/web/src/app/api/projects/[id]/utm-templates/[tid]/route.ts` — PATCH + DELETE
- `apps/web/src/app/[slug]/settings/utm-templates/page.tsx` — UI
- `apps/web/src/components/ProjectSidebar.tsx` — agregar link en Settings
- Docker compose — rebuild + migrate

## Notas
- Las UTMs se capturan automáticamente con el SDK (ya funciona)
- El template es solo para facilitar la creación de links con UTMs predefinidos
- No afecta el tracking existente
