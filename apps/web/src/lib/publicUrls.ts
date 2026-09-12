/**
 * Public Trell endpoint URLs shown to users in tracking snippets.
 *
 * Self-hosters: point these at your own API deployment. Defaults target
 * the Trell SaaS so snippets work out of the box.
 */
export const SDK_URL =
  process.env.NEXT_PUBLIC_SDK_URL ?? "https://trepi.relake.co/sdk/trell.js";

export const INGEST_URL =
  process.env.NEXT_PUBLIC_INGEST_URL ?? "https://trepi.relake.co/v1/events";
