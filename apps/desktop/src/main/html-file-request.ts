import { callZattoRpc } from "./zatto-rpc";

/** HTTP response needed by the HTML-file add service. */
export interface HtmlFileAddResponse {
  body: unknown;
  status: number;
}

/** Session entry fields used to reconcile an interrupted add request. */
export interface HtmlFileSessionEntry {
  absPath: string;
  id: string;
}

/**
 * Adds files to the active workspace through zatto's JSON-RPC endpoint.
 *
 * @param url - Absolute URL of the owned zatto `/rpc` endpoint
 * @param paths - Absolute file paths to add
 * @param signal - Cancellation signal covering both RPC calls
 * @returns HTTP-style response; status 201 marks a successful add
 * @throws When a request cannot be sent
 */
export async function requestHtmlFileAdd(
  url: string,
  paths: readonly string[],
  signal: AbortSignal,
): Promise<HtmlFileAddResponse> {
  const session = await callZattoRpc(url, "session.get", {}, signal);
  const workspaceId = session.ok
    ? readActiveWorkspaceId(session.result)
    : undefined;
  if (workspaceId === undefined) {
    return { body: undefined, status: session.ok ? 502 : session.status };
  }
  const added = await callZattoRpc(
    url,
    "session.add",
    { paths: [...paths], workspaceId },
    signal,
  );
  return added.ok
    ? { body: added.result, status: 201 }
    : { body: undefined, status: added.status };
}

/** Reads path and ID pairs from the owned session without following redirects. */
export async function inspectHtmlFileSession(
  ownershipUrl: string,
  signal: AbortSignal,
): Promise<HtmlFileSessionEntry[]> {
  const outcome = await callZattoRpc(
    new URL("rpc", ownershipUrl).toString(),
    "session.get",
    {},
    signal,
  );
  if (!outcome.ok) throw new Error("session request failed");
  const body = outcome.result;
  if (!isRecord(body) || !Array.isArray(body.entries)) {
    throw new Error("session response is invalid");
  }
  const entries: HtmlFileSessionEntry[] = [];
  for (const entry of body.entries) {
    if (
      !isRecord(entry) ||
      typeof entry.absPath !== "string" ||
      typeof entry.id !== "string" ||
      entry.id === ""
    ) {
      throw new Error("session entry is invalid");
    }
    entries.push({ absPath: entry.absPath, id: entry.id });
  }
  return entries;
}

/** Parses entry IDs from a successful zatto add response. */
export function parseAddedIds(body: unknown): string[] | undefined {
  if (!isRecord(body) || !Array.isArray(body.added)) return undefined;
  const ids: string[] = [];
  for (const entry of body.added) {
    if (!isRecord(entry) || typeof entry.id !== "string" || entry.id === "") {
      return undefined;
    }
    ids.push(entry.id);
  }
  return ids;
}

function readActiveWorkspaceId(value: unknown): string | undefined {
  if (!isRecord(value)) return undefined;
  const id = value.activeWorkspaceId;
  return typeof id === "string" && id !== "" ? id : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
