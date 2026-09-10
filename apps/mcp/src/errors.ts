export type McpErrorCode =
  | "project_not_found"
  | "project_forbidden"
  | "destructive_disabled"
  | "confirm_required"
  | "invalid_input"
  | "internal_error";

export class McpError extends Error {
  readonly code: McpErrorCode;
  constructor(code: McpErrorCode, message: string) {
    super(message);
    this.name = "McpError";
    this.code = code;
  }
}

export interface ToolResult {
  [key: string]: unknown;
  content: [{ type: "text"; text: string }];
  isError?: boolean;
}

export function okResult(data: unknown): ToolResult {
  return { content: [{ type: "text", text: JSON.stringify(data) }] };
}

export function errorResult(code: McpErrorCode, message: string): ToolResult & { isError: true } {
  return {
    content: [{ type: "text", text: JSON.stringify({ error: { code, message } }) }],
    isError: true,
  };
}

/** Run a tool handler, converting McpError (and unexpected throws) to results. */
export async function runTool<T>(fn: () => Promise<T>): Promise<ToolResult> {
  try {
    return okResult(await fn());
  } catch (e) {
    if (e instanceof McpError) return errorResult(e.code, e.message);
    return errorResult("internal_error", e instanceof Error ? e.message : "internal error");
  }
}
