/** Transport constants agreed in docs/sdk-contract.md §13. */

export const DEFAULT_ENDPOINT = "https://api.trell.dev/v1/events";
export const MAX_BATCH = 10;
export const MAX_BATCH_INTERVAL_MS = 5_000;
export const MAX_PAYLOAD_BYTES = 64 * 1024;
export const MAX_PROPERTY_BYTES = 4 * 1024;
export const MAX_QUEUE = 100;
export const SESSION_IDLE_MS = 30 * 60 * 1000;
export const COOKIE_VISITOR = "trell:vid";
export const STORAGE_SESSION = "trell:sid";
export const STORAGE_UTM = "trell:utm";
