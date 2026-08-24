export interface ApiConfig {
  /** Secret used to bootstrap projects (creates pk/sk). Never exposed to browsers. */
  adminKey: string;
  /** Publishable keys generated with this prefix. */
  pkPrefix: string;
  /** Secret keys generated with this prefix. */
  skPrefix: string;
  /** Max accepted request body bytes. */
  maxBodyBytes: number;
  /** Max events per request. */
  maxBatch: number;
  /** Rate limit window (ms) and max requests per window per key. */
  rateLimitWindowMs: number;
  rateLimitMax: number;
}

export function configFromEnv(env: NodeJS.ProcessEnv = process.env): ApiConfig {
  return {
    adminKey: env.TRELL_ADMIN_KEY ?? "",
    pkPrefix: env.TRELL_PK_PREFIX ?? "pk",
    skPrefix: env.TRELL_SK_PREFIX ?? "sk",
    maxBodyBytes: Number(env.TRELL_MAX_BODY_BYTES ?? 256 * 1024),
    maxBatch: Number(env.TRELL_MAX_BATCH ?? 200),
    rateLimitWindowMs: Number(env.TRELL_RATE_LIMIT_WINDOW_MS ?? 60_000),
    rateLimitMax: Number(env.TRELL_RATE_LIMIT_MAX ?? 300),
  };
}
