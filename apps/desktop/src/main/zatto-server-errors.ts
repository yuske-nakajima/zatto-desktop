import type { ZattoServerErrorCode } from "./zatto-server-manager-types";

/** Error carrying a stable zatto server lifecycle category. */
export class ZattoServerError extends Error {
  readonly code: ZattoServerErrorCode;

  /**
   * Creates a typed lifecycle error.
   *
   * @param code - Stable category for caller branching
   * @param message - Human-readable failure description
   * @param cause - Lower-level failure when available
   */
  constructor(code: ZattoServerErrorCode, message: string, cause?: unknown) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = "ZattoServerError";
    this.code = code;
  }
}

/**
 * Preserves an existing typed error or wraps an unknown failure.
 *
 * @param error - Failure to normalize
 * @param code - Category used for an untyped failure
 * @param message - Description used for an untyped failure
 * @returns Typed lifecycle error
 */
export function toZattoServerError(
  error: unknown,
  code: ZattoServerErrorCode,
  message: string,
): ZattoServerError {
  return error instanceof ZattoServerError
    ? error
    : new ZattoServerError(code, message, error);
}
