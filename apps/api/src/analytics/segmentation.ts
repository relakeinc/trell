import type { StoredEvent } from "../repositories/types";

/**
 * Session segment: find sessions that contain at least one event matching the
 * segment criteria. Used for funnels — avoids misleading drop-offs when the
 * qualifying event is in a different step than the funnel entry.
 *
 * Example: filter page=/landing finds sessions where ANY event has page=/landing,
 * then the funnel runs on ALL events in those sessions.
 */
export function getSessionSegment(
  events: StoredEvent[],
  segment: Record<string, string> | undefined,
): Set<string> {
  if (!segment || Object.keys(segment).length === 0) {
    // No segment: all sessions qualify
    const all = new Set<string>();
    for (const e of events) all.add(e.sessionId);
    return all;
  }

  const qualifying = new Set<string>();
  for (const e of events) {
    if (matchesSegment(e, segment)) {
      qualifying.add(e.sessionId);
    }
  }
  return qualifying;
}

/**
 * SQL variant: find qualifying session IDs via raw query.
 * Returns the set of session_ids that contain at least one event matching segment.
 */
export function buildSessionSegmentWhere(
  segment: Record<string, string> | undefined,
): { where: string; params: unknown[] } {
  if (!segment || Object.keys(segment).length === 0) {
    return { where: "", params: [] };
  }

  const conditions: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  for (const [key, value] of Object.entries(segment)) {
    const col = segmentColumn(key);
    if (col) {
      conditions.push(`${col} = $${idx++}`);
      params.push(value);
    }
  }

  if (conditions.length === 0) return { where: "", params: [] };

  return {
    where: `session_id IN (SELECT DISTINCT session_id FROM "Event" WHERE ${conditions.join(" AND ")})`,
    params,
  };
}

function matchesSegment(e: StoredEvent, segment: Record<string, string>): boolean {
  for (const [key, value] of Object.entries(segment)) {
    const actual = segmentValue(e, key);
    if (actual !== value) return false;
  }
  return true;
}

function segmentValue(e: StoredEvent, key: string): string | null {
  switch (key) {
    case "page": return e.pagePath;
    case "device": return e.deviceType;
    case "browser": return e.browser;
    case "os": return e.os;
    case "utmSource": return e.utmSource;
    case "utmMedium": return e.utmMedium;
    case "utmCampaign": return e.utmCampaign;
    case "form": return e.formId;
    default: return null;
  }
}

function segmentColumn(key: string): string | null {
  switch (key) {
    case "page": return "page_path";
    case "device": return "device_type";
    case "browser": return "browser";
    case "os": return "os";
    case "utmSource": return "utm_source";
    case "utmMedium": return "utm_medium";
    case "utmCampaign": return "utm_campaign";
    case "form": return "form_id";
    default: return null;
  }
}

/**
 * Event filter: filter events by dimension criteria.
 * Used for stats/series/breakdown (not funnels).
 */
export function filterEvents(
  events: StoredEvent[],
  filters: Record<string, string> | undefined,
): StoredEvent[] {
  if (!filters || Object.keys(filters).length === 0) return events;
  return events.filter((e) => matchesSegment(e, filters));
}
