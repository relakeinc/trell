import type { Context } from "hono";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }

  toBody() {
    return { error: { code: this.code, message: this.message } };
  }
}

export function sendError(c: Context, status: number, code: string, message: string): Response {
  return c.json({ error: { code, message } }, status as never);
}

export function sendOk(c: Context, status: number, body: unknown): Response {
  return c.json(body, status as never);
}

export const badRequest = (c: Context, msg: string, code = "invalid_request") => sendError(c, 400, code, msg);
export const unauthorized = (c: Context, msg = "invalid_api_key", code = "unauthorized") => sendError(c, 401, code, msg);
export const forbidden = (c: Context, msg = "origin_not_allowed", code = "forbidden") => sendError(c, 403, code, msg);
export const tooMany = (c: Context, retryAfter: number, msg = "rate_limited", code = "rate_limited") => {
  c.header("Retry-After", String(Math.ceil(retryAfter / 1000)));
  return sendError(c, 429, code, msg);
};
export const payloadTooLarge = (c: Context, msg = "payload_too_large", code = "payload_too_large") => sendError(c, 413, code, msg);
