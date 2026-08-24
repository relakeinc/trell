/**
 * Zod schemas — used as the authoritative validation layer (API side).
 * The browser SDK does NOT depend on zod; it uses its own tiny validator.
 * See docs/sdk-contract.md §11.
 */
import { z } from "zod";

export const utmSchema = z
  .object({
    source: z.string().nullable(),
    medium: z.string().nullable(),
    campaign: z.string().nullable(),
    term: z.string().nullable(),
    content: z.string().nullable(),
  })
  .nullable();

export const deviceSchema = z.object({
  type: z.enum(["desktop", "tablet", "mobile"]),
  os: z.string().nullable(),
  browser: z.string().nullable(),
  viewport: z.tuple([z.number(), z.number()]),
});

export const formContextSchema = z.object({
  id: z.string().min(1),
  name: z.string().optional(),
});

export const baseEventSchema = z.object({
  v: z.literal(1),
  event_id: z.string().uuid(),
  project: z.string().min(1),
  type: z.string(),
  ts: z.number().int().nonnegative(),
  session_id: z.string(),
  visitor_id: z.string(),
  url: z.string(),
  page: z.object({ path: z.string(), title: z.string() }),
  referrer: z.string(),
  utm: utmSchema,
  device: deviceSchema,
  properties: z.record(z.string(), z.unknown()),
});

export const formEventSchema = baseEventSchema.extend({ form: formContextSchema });

export const eventSchema = z.union([
  formEventSchema.extend({ type: z.literal("field_interaction"), field: z.string(), interaction: z.enum(["focus", "change"]) }),
  formEventSchema.extend({ type: z.literal("form_submit"), valid: z.boolean() }),
  formEventSchema.extend({ type: z.literal("form_success"), timeToSuccessMs: z.number().optional() }),
  formEventSchema.extend({ type: z.literal("form_abandon"), durationMs: z.number() }),
  formEventSchema.extend({ type: z.enum(["form_view", "form_start"]) }),
  baseEventSchema.extend({ type: z.literal("cta_click"), cta: z.string(), label: z.string().optional(), href: z.string().optional() }),
  baseEventSchema,
]);

export const batchSchema = z.array(eventSchema);
