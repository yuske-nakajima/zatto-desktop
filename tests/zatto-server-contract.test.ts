import { describe, expect, it } from "vitest";

import {
  parseZattoRuntimeRecord,
  validateZattoHealthIdentity,
} from "../src/main/zatto-server-contract";

const INSTANCE_ID = "desktop-probe-instance";
const validRuntimeRecord = {
  instanceId: INSTANCE_ID,
  pid: 1234,
  port: 49152,
  processFingerprint: "process-fingerprint",
  protocolVersion: 1,
};

describe("parseZattoRuntimeRecord", () => {
  it("accepts the runtime record written by zatto", () => {
    expect(parseZattoRuntimeRecord(validRuntimeRecord)).toEqual(
      validRuntimeRecord,
    );
  });

  it.each([
    null,
    {},
    { ...validRuntimeRecord, port: 0 },
    { ...validRuntimeRecord, port: 65536 },
    { ...validRuntimeRecord, pid: 0 },
    { ...validRuntimeRecord, instanceId: "" },
    { ...validRuntimeRecord, processFingerprint: "" },
    { ...validRuntimeRecord, protocolVersion: 0 },
  ])("rejects an invalid runtime record: %j", (record) => {
    expect(() => parseZattoRuntimeRecord(record)).toThrow(
      "zatto runtime record is invalid",
    );
  });
});

describe("validateZattoHealthIdentity", () => {
  const runtimeRecord = validRuntimeRecord;

  it("accepts health data that identifies the started server", () => {
    expect(
      validateZattoHealthIdentity(
        {
          instanceId: INSTANCE_ID,
          name: "zatto",
          protocolVersion: 1,
          version: "0.1.3",
        },
        runtimeRecord,
      ),
    ).toEqual({
      instanceId: INSTANCE_ID,
      name: "zatto",
      protocolVersion: 1,
      version: "0.1.3",
    });
  });

  it.each([
    {
      instanceId: INSTANCE_ID,
      name: "other",
      protocolVersion: 1,
      version: "0.1.3",
    },
    {
      instanceId: "other",
      name: "zatto",
      protocolVersion: 1,
      version: "0.1.3",
    },
    {
      instanceId: INSTANCE_ID,
      name: "zatto",
      protocolVersion: 2,
      version: "0.1.3",
    },
    {
      instanceId: INSTANCE_ID,
      name: "zatto",
      protocolVersion: 1,
      version: "0.1.2",
    },
  ])("rejects a health identity mismatch: %j", (identity) => {
    expect(() => validateZattoHealthIdentity(identity, runtimeRecord)).toThrow(
      "zatto health identity does not match the runtime record",
    );
  });

  it("rejects a mutually matching unsupported protocol version", () => {
    expect(() =>
      validateZattoHealthIdentity(
        {
          instanceId: INSTANCE_ID,
          name: "zatto",
          protocolVersion: 2,
          version: "0.1.3",
        },
        { ...runtimeRecord, protocolVersion: 2 },
      ),
    ).toThrow("zatto health identity does not match the runtime record");
  });
});
