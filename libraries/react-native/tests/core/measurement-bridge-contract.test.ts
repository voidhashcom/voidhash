import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { mapNativeMeasurementError } from "../../src/core/measurement";

const typesSource = readFileSync(
  new URL("../../src/specs/measurement/MeasurementTypes.nitro.ts", import.meta.url),
  "utf8",
);

describe("measurement Nitro bridge contract", () => {
  it("has a discriminated internal command schema for every durable command category", () => {
    const schema = typesSource.slice(
      typesSource.indexOf("export type MeasurementCommandSchema"),
      typesSource.indexOf("export interface MeasurementCommand extends"),
    );
    for (const variant of [
      "MeasurementEnqueueRecordCommand",
      "MeasurementIdentityTransitionCommand",
      "MeasurementConsentTransitionCommand",
      "MeasurementSessionSignalCommand",
      "MeasurementColdLaunchInputCommand",
      "MeasurementTransactionDedupCommand",
    ]) {
      expect(schema).toContain(variant);
    }
    expect(typesSource).toMatch(/readonly kind: "enqueueRecord"/);
    expect(typesSource).toMatch(/readonly kind: "transactionDedup"/);
  });

  it("does not permit JSON strings or unknown records as bridge payloads", () => {
    const payloadDeclarations = [...typesSource.matchAll(/readonly \w*[Pp]ayload\w*\??:\s*([^;]+);/g)];
    expect(payloadDeclarations.length).toBeGreaterThan(0);
    for (const declaration of payloadDeclarations) {
      expect(declaration[1]).not.toContain("string");
      expect(declaration[1]).not.toContain("Record<");
      expect(declaration[1]).not.toContain("unknown");
    }
    expect(typesSource).not.toContain("Record<string, unknown>");
  });

  it("maps native rejection objects to stable typed errors", () => {
    const error = mapNativeMeasurementError({
      code: "transport",
      message: "temporarily unavailable",
      source: "android",
    });
    expect(error).toMatchObject({ code: "transport", source: "android" });
    expect(mapNativeMeasurementError({ code: "future-code", source: "ios" })).toMatchObject({
      code: "unknownNative",
      source: "ios",
    });
  });
});
