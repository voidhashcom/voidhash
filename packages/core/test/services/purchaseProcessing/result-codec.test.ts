import { describe, expect, it } from "vite-plus/test";
import { Option } from "effect";

import { PurchaseProcessingResult } from "../../../src/domain/purchaseProcessing/PurchaseProcessing.ts";
import {
  decodePurchaseProcessingResult,
  encodePurchaseProcessingResult,
} from "../../../src/services/purchaseProcessing/result-codec.ts";

/** Fresh domain result per test; override any field via the partial. */
const result = (
  overrides: Partial<{
    personId: string;
    purchaseId: Option.Option<string>;
    subscriptionId: Option.Option<string>;
    transactionId: Option.Option<string>;
    changedGrantIds: ReadonlyArray<string>;
    analyticsEventIds: ReadonlyArray<string>;
    idempotent: boolean;
  }> = {},
): PurchaseProcessingResult =>
  new PurchaseProcessingResult({
    analyticsEventIds: [],
    changedGrantIds: [],
    idempotent: false,
    personId: "person_1",
    purchaseId: Option.none(),
    subscriptionId: Option.none(),
    transactionId: Option.none(),
    ...overrides,
  });

describe("encodePurchaseProcessingResult", () => {
  it("produces a flat JSON shape with the expected keys", () => {
    const encoded = encodePurchaseProcessingResult(result());
    expect(Object.keys(encoded).sort()).toEqual(
      [
        "analyticsEventIds",
        "changedGrantIds",
        "idempotent",
        "personId",
        "purchaseId",
        "subscriptionId",
        "transactionId",
      ].sort(),
    );
  });

  it("maps Option.some(string) → the inner string", () => {
    const encoded = encodePurchaseProcessingResult(
      result({
        purchaseId: Option.some("pur_1"),
        subscriptionId: Option.some("sub_1"),
        transactionId: Option.some("txn_1"),
      }),
    );
    expect(encoded.purchaseId).toBe("pur_1");
    expect(encoded.subscriptionId).toBe("sub_1");
    expect(encoded.transactionId).toBe("txn_1");
  });

  it("maps Option.none() → null for every optional id", () => {
    const encoded = encodePurchaseProcessingResult(result());
    expect(encoded.purchaseId).toBeNull();
    expect(encoded.subscriptionId).toBeNull();
    expect(encoded.transactionId).toBeNull();
  });

  it("maps each optional id independently (mixed some/none)", () => {
    const encoded = encodePurchaseProcessingResult(
      result({
        purchaseId: Option.some("pur_1"),
        subscriptionId: Option.none(),
        transactionId: Option.some("txn_1"),
      }),
    );
    expect(encoded.purchaseId).toBe("pur_1");
    expect(encoded.subscriptionId).toBeNull();
    expect(encoded.transactionId).toBe("txn_1");
  });

  it("preserves the personId verbatim", () => {
    const encoded = encodePurchaseProcessingResult(result({ personId: "person_xyz" }));
    expect(encoded.personId).toBe("person_xyz");
  });

  it("preserves array fields (analyticsEventIds, changedGrantIds)", () => {
    const encoded = encodePurchaseProcessingResult(
      result({
        analyticsEventIds: ["evt_1", "evt_2"],
        changedGrantIds: ["grant_1"],
      }),
    );
    expect(encoded.analyticsEventIds).toEqual(["evt_1", "evt_2"]);
    expect(encoded.changedGrantIds).toEqual(["grant_1"]);
  });

  it("preserves empty array fields", () => {
    const encoded = encodePurchaseProcessingResult(result());
    expect(encoded.analyticsEventIds).toEqual([]);
    expect(encoded.changedGrantIds).toEqual([]);
  });

  it("preserves the idempotent flag when true", () => {
    const encoded = encodePurchaseProcessingResult(result({ idempotent: true }));
    expect(encoded.idempotent).toBe(true);
  });

  it("preserves the idempotent flag when false", () => {
    const encoded = encodePurchaseProcessingResult(result({ idempotent: false }));
    expect(encoded.idempotent).toBe(false);
  });
});

describe("decodePurchaseProcessingResult", () => {
  it("reconstructs a PurchaseProcessingResult from the encoded shape", () => {
    const decoded = decodePurchaseProcessingResult({
      analyticsEventIds: ["evt_1"],
      changedGrantIds: ["grant_1"],
      idempotent: false,
      personId: "person_1",
      purchaseId: "pur_1",
      subscriptionId: "sub_1",
      transactionId: "txn_1",
    });
    expect(decoded).toBeInstanceOf(PurchaseProcessingResult);
    expect(decoded.personId).toBe("person_1");
    expect(decoded.analyticsEventIds).toEqual(["evt_1"]);
    expect(decoded.changedGrantIds).toEqual(["grant_1"]);
  });

  it("maps a non-null id string → Option.some(string)", () => {
    const decoded = decodePurchaseProcessingResult({
      analyticsEventIds: [],
      changedGrantIds: [],
      idempotent: false,
      personId: "person_1",
      purchaseId: "pur_1",
      subscriptionId: "sub_1",
      transactionId: "txn_1",
    });
    expect(decoded.purchaseId).toStrictEqual(Option.some("pur_1"));
    expect(decoded.subscriptionId).toStrictEqual(Option.some("sub_1"));
    expect(decoded.transactionId).toStrictEqual(Option.some("txn_1"));
  });

  it("maps a null id → Option.none()", () => {
    const decoded = decodePurchaseProcessingResult({
      analyticsEventIds: [],
      changedGrantIds: [],
      idempotent: false,
      personId: "person_1",
      purchaseId: null,
      subscriptionId: null,
      transactionId: null,
    });
    expect(Option.isNone(decoded.purchaseId)).toBe(true);
    expect(Option.isNone(decoded.subscriptionId)).toBe(true);
    expect(Option.isNone(decoded.transactionId)).toBe(true);
  });

  it("ALWAYS forces idempotent: true even when the encoded flag was false", () => {
    // The decode path only runs for a duplicate delivery — the original call
    // already produced the canonical operational state, so the replayed result
    // is by definition idempotent regardless of what was stored.
    const decoded = decodePurchaseProcessingResult({
      analyticsEventIds: [],
      changedGrantIds: [],
      idempotent: false,
      personId: "person_1",
      purchaseId: null,
      subscriptionId: null,
      transactionId: null,
    });
    expect(decoded.idempotent).toBe(true);
  });

  it("forces idempotent: true even when the encoded flag was already true", () => {
    const decoded = decodePurchaseProcessingResult({
      analyticsEventIds: [],
      changedGrantIds: [],
      idempotent: true,
      personId: "person_1",
      purchaseId: null,
      subscriptionId: null,
      transactionId: null,
    });
    expect(decoded.idempotent).toBe(true);
  });
});

describe("encode → decode round-trip", () => {
  it("preserves the full structure except the forced idempotent flag", () => {
    const original = result({
      analyticsEventIds: ["evt_1", "evt_2"],
      changedGrantIds: ["grant_1"],
      idempotent: false,
      personId: "person_42",
      purchaseId: Option.some("pur_1"),
      subscriptionId: Option.none(),
      transactionId: Option.some("txn_1"),
    });

    const roundTripped = decodePurchaseProcessingResult(encodePurchaseProcessingResult(original));

    expect(roundTripped.personId).toBe(original.personId);
    expect(roundTripped.analyticsEventIds).toEqual(original.analyticsEventIds);
    expect(roundTripped.changedGrantIds).toEqual(original.changedGrantIds);
    expect(roundTripped.purchaseId).toStrictEqual(original.purchaseId);
    expect(roundTripped.subscriptionId).toStrictEqual(original.subscriptionId);
    expect(roundTripped.transactionId).toStrictEqual(original.transactionId);
    // The only intentional divergence: idempotent is always true post-decode.
    expect(original.idempotent).toBe(false);
    expect(roundTripped.idempotent).toBe(true);
  });

  it("round-trips with all optional ids absent", () => {
    const original = result({ personId: "person_only" });

    const roundTripped = decodePurchaseProcessingResult(encodePurchaseProcessingResult(original));

    expect(roundTripped.personId).toBe("person_only");
    expect(Option.isNone(roundTripped.purchaseId)).toBe(true);
    expect(Option.isNone(roundTripped.subscriptionId)).toBe(true);
    expect(Option.isNone(roundTripped.transactionId)).toBe(true);
    expect(roundTripped.analyticsEventIds).toEqual([]);
    expect(roundTripped.changedGrantIds).toEqual([]);
  });
});
