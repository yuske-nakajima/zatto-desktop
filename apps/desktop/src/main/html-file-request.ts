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

/** Sends a bounded JSON add request without following redirects. */
export async function requestHtmlFileAdd(
  url: string,
  paths: readonly string[],
  signal: AbortSignal,
): Promise<HtmlFileAddResponse> {
  const response = await fetch(url, {
    body: JSON.stringify({ paths }),
    headers: { "content-type": "application/json" },
    method: "POST",
    redirect: "error",
    signal,
  });
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    body = undefined;
  }
  return { body, status: response.status };
}

/** Reads path and ID pairs from the owned session without following redirects. */
export async function inspectHtmlFileSession(
  ownershipUrl: string,
  signal: AbortSignal,
): Promise<HtmlFileSessionEntry[]> {
  const response = await fetch(new URL("api/session", ownershipUrl), {
    redirect: "error",
    signal,
  });
  if (response.status !== 200) throw new Error("session request failed");
  const body: unknown = await response.json();
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
