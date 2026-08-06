/**
 * Checks a candidate URL against a validated ownership origin.
 *
 * @param candidate - URL requested by renderer content
 * @param ownershipUrl - Validated URL returned by the server manager
 * @returns Whether the URL has the exact owned HTTP origin and no userinfo
 */
export function isAllowedOwnedNavigation(
  candidate: string,
  ownershipUrl: string,
): boolean {
  try {
    const requested = new URL(candidate);
    const owned = new URL(ownershipUrl);
    return (
      owned.protocol === "http:" &&
      owned.hostname === "127.0.0.1" &&
      owned.username === "" &&
      owned.password === "" &&
      requested.origin === owned.origin &&
      requested.username === "" &&
      requested.password === ""
    );
  } catch {
    return false;
  }
}

/**
 * Checks that a subframe navigation remains on a zatto view route.
 *
 * @param candidate - Subframe document URL requested by renderer content
 * @param ownershipUrl - Validated URL returned by the server manager
 * @returns Whether the owned URL has a decoded `f` route and entry segment
 */
export function isAllowedOwnedFrameNavigation(
  candidate: string,
  ownershipUrl: string,
): boolean {
  if (!isAllowedOwnedNavigation(candidate, ownershipUrl)) return false;
  const segments = new URL(candidate).pathname.split("/");
  try {
    return (
      decodeURIComponent(segments[1] ?? "") === "f" &&
      (segments[2] ?? "") !== ""
    );
  } catch {
    return false;
  }
}
