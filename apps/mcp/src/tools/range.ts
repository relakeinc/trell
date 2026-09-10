import { McpError } from "../errors";

export const DAY_MS = 86_400_000;
export const MAX_RANGE_DAYS = 366;
export const DEFAULT_RANGE_DAYS = 30;

export function parseDate(value: string | undefined, name: string): Date | undefined {
  if (value === undefined) return undefined;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) throw new McpError("invalid_input", `'${name}' must be an ISO date string`);
  return d;
}

export interface DateRange {
  from: Date;
  to: Date;
}

/** Resolve from/to with defaults (last `defDays`) and guardrails. */
export function resolveRange(fromRaw?: string, toRaw?: string, defDays: number = DEFAULT_RANGE_DAYS): DateRange {
  const to = parseDate(toRaw, "to") ?? new Date();
  const from = parseDate(fromRaw, "from") ?? new Date(to.getTime() - defDays * DAY_MS);
  if (from > to) throw new McpError("invalid_input", "'from' must be before 'to'");
  if (to.getTime() - from.getTime() > MAX_RANGE_DAYS * DAY_MS) {
    throw new McpError("invalid_input", `date range must be ${MAX_RANGE_DAYS} days or less`);
  }
  return { from, to };
}
