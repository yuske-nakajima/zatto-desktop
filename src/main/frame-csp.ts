import { isAllowedOwnedFrameNavigation } from "./owned-origin";

const NO_ASSET_SOURCE_DIRECTIVES = [
  "sandbox allow-scripts",
  "default-src 'none'",
  "script-src 'unsafe-inline' data: blob:",
  "style-src 'unsafe-inline' data: blob:",
  "img-src data: blob:",
  "font-src data: blob:",
  "media-src data: blob:",
  "connect-src 'none'",
  "form-action 'none'",
  "base-uri 'none'",
  "object-src 'none'",
  "frame-src 'none'",
  "worker-src 'none'",
] as const;

function encodeCspPath(pathname: string): string {
  let encoded = "";
  for (let index = 0; index < pathname.length; index += 1) {
    const character = pathname[index] ?? "";
    const percentTriplet = pathname.slice(index, index + 3);
    if (/^%[0-9a-f]{2}$/i.test(percentTriplet)) {
      encoded += percentTriplet;
      index += 2;
    } else if (/^[A-Za-z0-9._~/-]$/.test(character)) {
      encoded += character;
    } else {
      const codePoint = pathname.codePointAt(index);
      if (codePoint === undefined) continue;
      const rawCharacter = String.fromCodePoint(codePoint);
      encoded += encodeURIComponent(rawCharacter).replace(
        /[!'()*]/g,
        (value) => `%${value.charCodeAt(0).toString(16).toUpperCase()}`,
      );
      if (rawCharacter.length === 2) index += 1;
    }
  }
  return encoded;
}

function getAssetDirectorySource(
  documentUrl: string,
  ownershipUrl: string,
): string | undefined {
  if (!isAllowedOwnedFrameNavigation(documentUrl, ownershipUrl)) {
    return undefined;
  }
  const document = new URL(documentUrl);
  const directory = document.pathname.endsWith("/")
    ? document.pathname
    : document.pathname.slice(0, document.pathname.lastIndexOf("/") + 1);
  return `${document.origin}${encodeCspPath(directory)}`;
}

/**
 * Builds a sandbox CSP that permits assets only beside a zatto view document.
 *
 * @param documentUrl - Owned subframe document response URL
 * @param ownershipUrl - Validated URL returned by the server manager
 * @returns CSP without same-origin, navigation, form, or network privileges
 */
export function createFrameSandboxPolicy(
  documentUrl: string,
  ownershipUrl: string,
): string {
  const assetSource = getAssetDirectorySource(documentUrl, ownershipUrl);
  return NO_ASSET_SOURCE_DIRECTIVES.map((directive) => {
    if (
      assetSource === undefined ||
      !/^(script|style|img|font|media)-src /.test(directive)
    ) {
      return directive;
    }
    return `${directive} ${assetSource}`;
  }).join("; ");
}
