# General Polish & Improvements

## Descripción
Mejoras generales de UX, performance y polish del producto.

## Tareas

### 1. CSP Headers para el SDK
- Agregar Content-Security-Policy headers en el API
- Permitir `trepi.relake.co` como script-src en los clientes
- Documentar CSP headers en la página de Tracking

### 2. Loading States Mejorados
- Skeleton loaders en todas las páginas (analytics, events, submissions)
- Spinner consistente en todos los botones de acción
- Empty states con ilustraciones (no solo texto)

### 3. Error Handling
- Toast notifications para errores de red
- Retry automático en llamadas API fallidas
- Página de error 404 personalizada
- Página de error 500 personalizada

### 4. Responsive Design
- Sidebar colapsable en mobile
- Tablas con scroll horizontal en mobile
- Charts responsive (maintain aspect ratio)

### 5. Keyboard Shortcuts
- `R` para refresh en analytics
- `Esc` para cerrar modals
- `⌘K` para command palette (búsqueda)

### 6. Export Data
- Exportar analytics a CSV
- Exportar events a JSON
- Exportar submissions a CSV

### 7. API Rate Limiting Display
- Mostrar rate limit status en el dashboard
- Warning cuando se acerca al límite del plan
- Upgrade prompt cuando se alcanza el límite

### 8. Onboarding Flow Mejorado
- Step 1: Nombre del proyecto
- Step 2: Dominio del sitio
- Step 3: Copiar snippet de tracking
- Step 4: Verificar que el tracking funciona (test event)
- Step 5: Dashboard listo

## Prioridad
- CSP Headers: ALTA (seguridad)
- Loading States: MEDIA (UX)
- Error Handling: ALTA (UX)
- Responsive: ALTA (mobile users)
- Keyboard Shortcuts: BAJA (power users)
- Export Data: MEDIA (utility)
- Rate Limiting Display: MEDIA (transparency)
- Onboarding: ALTA (new user experience)
