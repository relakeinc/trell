# Trell — Prompt 09 · Estado de implementación

> **Prompt 09: cerrar las 3 desviaciones del SDK.** `@trell/sdk` queda estable.
> `docs/sdk-contract.md` **se actualizó solo donde había decisión contractual**
> (identify + destroy), documentado en un *Decision log*. Handoff: `status-prompt08.md`.

---

## 1. `identify()` — semántica resuelta
- **Antes**: mapeaba lo que el llamador pasaba (asumía hash pre-calculado `emailHash`).
- **Ahora** (contract §2.4 / §8.3, **decisión documentada**):
  - `trell.identify({ userId, email })` recibe el identificador **crudo**.
  - El SDK calcula **SHA-256 síncrono** (JS puro, determinista en cualquier entorno)
    sobre cada valor y **solo envía el hash** (`identify_user`, `identify_email`).
  - **Nunca** transmite PII cruda; el valor crudo solo existe transitoriamente.
- Implementado en `src/rng.ts` (`sha256Sync` + `hashIdentity`); reutiliza la función
  de hashing existente en lugar de duplicar una ruta.

## 2. `form().destroy()` — ya no es no-op
- **Antes**: no-op.
- **Ahora** (contract §2.3, **decisión documentada**): elimina listeners del
  elemento, desconecta observers (Intersection/MutationObserver), limpia timers y
  estado del formulario; es **idempotente** y permite **destroy + re-init sin
  duplicar eventos**.

## 3. Bundle < 5 KB gzip — medición y decisión
| | raw | gzip |
|---|---|---|
| Prompt 06 (antes de estas funciones) | 14.9 KB | 5.8 KB |
| Prompt 09 (identify SHA-256 + destroy) | 17.0 KB | **6.8 KB** |

- **IIFE autocontenido**: **0 dependencias externas** / `@trell/shared` enlazado a
  literales · **0 referencias a zod**.
- **Auditoría**: reducido código duplicado (check de privacidad redundante en
  `storage`, helper trivial en `context`). El incremento (~1 KB gzip) proviene
  principalmente de la **implementación de SHA-256 síncrono** (requerida por
  `identify`) y del cleanup de `destroy()`.
- **Decisión**: cumplir `<5 KB gzip` exigiría recortar funcionalidad contractual
  (SHA-256 real, la cola offline/retry del transporte, el parseo granular de
  dispositivo, auto-detección). **Siguiendo la regla —"no sacrificar funcionalidades
  por el número"— se mantienen las features** y se documenta el tradeoff. El SDK
  queda en ~6.8 KB gzip, ligero y sin dependencias.

## 4. Estado
- `pnpm build` ✓ · `pnpm typecheck` ✓ · `pnpm test` → **102 tests** (SDK **40**,
  API 50, web 12).
- SDK: añadidos tests de **hash de identify** (vector SHA-256 + no-leak de PII) y de
  **lifecycle de destroy** (sin listeners duplicados, re-init seguro).

## 5. Contrato
- `docs/sdk-contract.md`:
  - `§2.4` / `§8.3`: `identify({ userId, email })` crudo → SHA-256 síncrono → solo hash.
  - `§2.3`: `form().destroy()` funcional (limpieza + re-init seguro).
  - Añadido **Decision log (Prompt 09)** al final.
  - El resto del contrato **permanece intacto**.

---

## 6. Siguientes (roadmap)
- **Prompt 10** — Docker Compose / self-host (ahora la frontera `@trell/sdk` es
  estable: contrato fijo → apps/api → Postgres ← apps/web).
- **Prompt 11** — Pulido UX + onboarding + producto.
- **Prompt 12+** — Integraciones / features avanzadas.
