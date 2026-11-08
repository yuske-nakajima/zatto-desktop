/** Outcome of one JSON-RPC call to the owned zatto server. */
export interface ZattoRpcOutcome {
  /** Decoded `result` member when the call succeeded. */
  result?: unknown;
  /** HTTP status, or 200 when the transport succeeded. */
  status: number;
  /** True when the response carried a JSON-RPC success result. */
  ok: boolean;
}

let nextRequestId = 0;

/**
 * Calls one zatto JSON-RPC method without following redirects.
 *
 * @param endpoint - Absolute URL of the zatto `/rpc` endpoint
 * @param method - zatto command name such as `server.health`
 * @param params - Named command parameters
 * @param signal - Optional cancellation signal
 * @returns HTTP status plus the decoded result when the call succeeded
 * @throws When the request cannot be sent
 */
export async function callZattoRpc(
  endpoint: string,
  method: string,
  params: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<ZattoRpcOutcome> {
  const id = ++nextRequestId;
  const response = await fetch(endpoint, {
    body: JSON.stringify({ id, jsonrpc: "2.0", method, params }),
    headers: { "content-type": "application/json" },
    method: "POST",
    redirect: "error",
    ...(signal === undefined ? {} : { signal }),
  });
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return { ok: false, status: response.status };
  }
  if (
    !response.ok ||
    typeof body !== "object" ||
    body === null ||
    !("result" in body) ||
    "error" in body
  ) {
    return { ok: false, status: response.ok ? 502 : response.status };
  }
  return { ok: true, result: body.result, status: response.status };
}
