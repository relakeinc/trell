# Trell — Design direction (estilo Dub)

> Dirección de UX/UI. Se sigue al construir el dashboard; es el "design thinking"
> de referencia (inspirado en dub.co). Aplica a partir de Prompt 07.
> Actualizado con el rediseño Prompt 13 (repliqué el layout de la app de dub.co).

## Principios
- Interfaz **limpia y minimalista**: mucho espacio en blanco, bordes finos, paleta
  con acento oscuro (`#171717`) sobre fondos claros (`#f5f5f5`), labels pequeños.
- **Layout tipo Dub** replicado del código real (`apps/web/ui/layout/*`):
  - Frame exterior `bg-neutral-200` (gris); el contenido principal es un
    **card blanco con bordes redondeados** (`rounded-xl`) con `pb-2 pr-2`.
  - **Sidebar doble columna**:
    - **Rail de iconos** estrecho (`bg` transparente, iconos lucide-react,
      active = fondo blanco): logo arriba, herramientas, usuario + sign out abajo.
    - **Panel de navegación** ancho (`bg-neutral-100`, `rounded-xl`):
      switcher de proyecto arriba, grupos con secciones ("Insights"),
      footer "Usage" abajo.
  - **Nav items**: `h-8`, `rounded-lg`, active = `bg-blue-100/50 text-blue-600`.
- **Header por sección** con título a la izquierda y **acción primaria oscura**
  arriba a la derecha (botones pill negros).
- **KPI cards** (patrón `AnalyticsTabs` de Dub): grid dividido en celdas con un
  **dot de color** + label pequeño + valor grande (`text-3xl`); indicador activo
  como línea negra inferior.
- **Área chart** con gradiente (fill) y eje temporal; controles de rango.
- **Cards con conmutadores/tabs** (segmented control) dentro de cada card
  (p.ej. "Pages | UTM | Devices | Browser | OS").
- **Tablas** con headers, filas con hover y menú "⋯".
- **Empty states**: icono lucide + título + descripción + CTA opcional.
- Funnel/embudos como barras o pasos.
- Acciones contextuales con botones pill (negro) y opciones secundarias ghost.

## Tokens (Tailwind, `apps/web`)
- `bg #f5f5f5`, `muted #737373` (**texto** gris atenuado, antes era #f5f5f5 y casi invisible),
  `muted-bg #f5f5f5`, `card #fff`, `line #e5e5e5`, `line-emphasis #a3a3a3`,
  `ink #171717`, `ink-default #404040`, `ink-subtle #737373`, `ink-muted #a3a3a3`,
  `blue #2563eb`, `blue-light #dbeafe`.
- Tipografía: **Inter** vía `next/font/google` (`--font-inter`), `font-sans`.

> ⚠️ **`trell-muted` debe ser un color de TEXTO** (%). Usar `bg-trell-bg` / `bg-trell-muted-bg`
> para fondos grises claros — NO `bg-trell-muted` (que es texto gris).

## Iconos
- Se usa **`lucide-react`** (no emojis). Ejemplos:
  `LineChart` (Analytics), `GitBranch` (Funnels), `Scale` (Comparison),
  `Zap` (Events), `Settings2` (settings), `LogOut` (sign out), `Settings2`.

## Regla
- Mantener la coherencia con Dub: menos es más; no sobrecargar con widgets ni
  color; la jerarquía la marca el valor numérico + la escala tipográfica.

## Notas de implementación
- **Carga en tiempo real**: la lista de proyectos se obtiene con `refreshProjects()`
  (fetch a `GET /api/projects`) tras crear un proyecto y al montar; no hace falta
  recargar la página para ver el proyecto recién creado.
