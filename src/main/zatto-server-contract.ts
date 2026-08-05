import zattoPackage from "@yuske-nakajima/zatto/package.json";

/** Runtime identity persisted by the bundled zatto server. */
export interface ZattoRuntimeRecord {
  instanceId: string;
  pid: number;
  port: number;
  processFingerprint: string;
  protocolVersion: number;
}

/** Identity returned from the bundled zatto health endpoint. */
export interface ZattoHealthIdentity {
  instanceId: string;
  name: string;
  protocolVersion: number;
  version: string;
}

const ZATTO_NAME = "zatto";
const ZATTO_VERSION = zattoPackage.version;
const ZATTO_PROTOCOL_VERSION = 1;

/**
 * Parses and validates a zatto runtime record.
 *
 * @param value - Parsed JSON value read from the runtime file
 * @returns Validated runtime identity and network address
 * @throws Error when the runtime record does not match zatto's contract
 */
export function parseZattoRuntimeRecord(value: unknown): ZattoRuntimeRecord {
  if (!isRuntimeRecord(value)) {
    throw new Error("zatto runtime record is invalid");
  }
  return value;
}

/**
 * Validates that health data belongs to the started zatto process.
 *
 * @param value - Parsed JSON returned by `/api/health`
 * @param runtimeRecord - Runtime record written by the utility process
 * @returns Validated health identity
 * @throws Error when the health response does not identify the expected server
 */
export function validateZattoHealthIdentity(
  value: unknown,
  runtimeRecord: ZattoRuntimeRecord,
): ZattoHealthIdentity {
  if (!isHealthIdentity(value)) {
    throw new Error("zatto health identity does not match the runtime record");
  }

  if (
    value.name !== ZATTO_NAME ||
    value.version !== ZATTO_VERSION ||
    value.instanceId !== runtimeRecord.instanceId ||
    value.protocolVersion !== ZATTO_PROTOCOL_VERSION ||
    runtimeRecord.protocolVersion !== ZATTO_PROTOCOL_VERSION
  ) {
    throw new Error("zatto health identity does not match the runtime record");
  }
  return value;
}

function isRuntimeRecord(value: unknown): value is ZattoRuntimeRecord {
  if (!isRecord(value)) return false;
  return (
    isNonEmptyString(value.instanceId) &&
    isIntegerBetween(value.pid, 1, Number.MAX_SAFE_INTEGER) &&
    isIntegerBetween(value.port, 1, 65_535) &&
    isNonEmptyString(value.processFingerprint) &&
    isIntegerBetween(value.protocolVersion, 1, Number.MAX_SAFE_INTEGER)
  );
}

function isHealthIdentity(value: unknown): value is ZattoHealthIdentity {
  if (!isRecord(value)) return false;
  return (
    isNonEmptyString(value.instanceId) &&
    isNonEmptyString(value.name) &&
    isIntegerBetween(value.protocolVersion, 1, Number.MAX_SAFE_INTEGER) &&
    isNonEmptyString(value.version)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isIntegerBetween(
  value: unknown,
  minimum: number,
  maximum: number,
): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= minimum &&
    value <= maximum
  );
}
