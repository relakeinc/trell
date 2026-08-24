import { z } from "zod";

// ── SavedView config schemas (Zod discriminated union) ────────

export const FunnelViewConfigSchema = z.object({
  type: z.literal("funnel"),
  funnelId: z.string().uuid(),
  segment: z.record(z.string()).optional(),
});

export const SegmentViewConfigSchema = z.object({
  type: z.literal("segment"),
  dimension: z.string(),
  segment: z.record(z.string()),
  metric: z.string().optional(),
});

export const ComparisonViewConfigSchema = z.object({
  type: z.literal("comparison"),
  baselineFrom: z.string(),
  baselineTo: z.string(),
  compareFrom: z.string(),
  compareTo: z.string(),
  segment: z.record(z.string()).optional(),
  funnelId: z.string().uuid().optional(),
});

export const SavedViewConfigSchema = z.discriminatedUnion("type", [
  FunnelViewConfigSchema,
  SegmentViewConfigSchema,
  ComparisonViewConfigSchema,
]);

export type FunnelViewConfig = z.infer<typeof FunnelViewConfigSchema>;
export type SegmentViewConfig = z.infer<typeof SegmentViewConfigSchema>;
export type ComparisonViewConfig = z.infer<typeof ComparisonViewConfigSchema>;
export type SavedViewConfig = z.infer<typeof SavedViewConfigSchema>;

/** Validate config at write time. Throws ZodError on invalid. */
export function validateSavedViewConfig(type: string, config: unknown): SavedViewConfig {
  const obj = (typeof config === "object" && config !== null) ? config : {};
  return SavedViewConfigSchema.parse({ ...obj, type });
}

/** Safe parse at read time. Returns null on invalid. */
export function parseSavedViewConfig(type: string, configJson: string): SavedViewConfig | null {
  try {
    const raw: Record<string, unknown> = JSON.parse(configJson);
    const result = SavedViewConfigSchema.safeParse({ ...raw, type });
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}
