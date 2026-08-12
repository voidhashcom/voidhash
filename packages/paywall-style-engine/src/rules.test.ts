import { describe, expect, it } from "vitest";

import { normalizeStylePatch, repairFlexSizing } from "./normalize.ts";
import { validateStylePatch } from "./validate.ts";

describe("normalizeStylePatch", () => {
  it("translates the null-clear sentinel: auto for dimensions, deletion elsewhere", () => {
    const { patch } = normalizeStylePatch("view", { width: null, height: null, flex: null });
    expect(patch).toEqual({ width: "auto", height: "auto", flex: undefined });
  });

  it("clamps CSS-invalid numbers and reports the repair", () => {
    const { patch, diagnostics } = normalizeStylePatch("view", { gap: -4, opacity: 1.5 });
    expect(patch).toEqual({ gap: 0, opacity: 1 });
    expect(diagnostics.map((d) => d.code)).toEqual([
      "constraint-violation",
      "constraint-violation",
    ]);
  });

  it("clamps schema-declared minimums (fontSize >= 1)", () => {
    const { patch } = normalizeStylePatch("text", { fontSize: 0 });
    expect(patch).toEqual({ fontSize: 1 });
  });

  it("preserves valid negative margins", () => {
    const { patch, diagnostics } = normalizeStylePatch("view", { marginTop: -12 });
    expect(patch).toEqual({ marginTop: -12 });
    expect(diagnostics).toHaveLength(0);
  });

  it("derives *Enabled flags for gated group writes, explicit value winning", () => {
    const derived = normalizeStylePatch("view", { backgroundColor: "rgba(0, 0, 0, 1)" });
    expect(derived.patch["backgroundEnabled"]).toBe(true);
    expect(derived.diagnostics.some((d) => d.code === "enabled-flag-derived")).toBe(true);

    const explicit = normalizeStylePatch("view", {
      backgroundColor: "rgba(0, 0, 0, 1)",
      backgroundEnabled: false,
    });
    expect(explicit.patch["backgroundEnabled"]).toBe(false);
  });

  it("unwraps decoded CRDT array envelopes so snapshots can be written back", () => {
    const { patch } = normalizeStylePatch("view", {
      backgroundGradient: {
        kind: "linear",
        startX: 0,
        startY: 0,
        endX: 1,
        endY: 1,
        stops: [{ id: "a", pos: "a0", value: { color: "rgba(1, 2, 3, 1)", position: 0 } }],
      },
    });
    expect((patch["backgroundGradient"] as { stops: unknown[] }).stops).toEqual([
      { color: "rgba(1, 2, 3, 1)", position: 0 },
    ]);
  });
});

describe("repairFlexSizing", () => {
  it("clears explicit cross-axis stretch when fixing the size, leaving container-driven stretch alone", () => {
    const stretch = repairFlexSizing(
      { width: 100 },
      { style: { alignSelf: "stretch" }, parent: { direction: "column", alignItems: "stretch" } },
    );
    expect(stretch.patch).toEqual({ width: 100, alignSelf: "auto" });
    expect(stretch.diagnostics.map((d) => d.code)).toEqual(["sizing-conflict-repaired"]);

    const containerDriven = repairFlexSizing(
      { width: 100 },
      { style: { alignSelf: "auto" }, parent: { direction: "column", alignItems: "stretch" } },
    );
    expect(containerDriven.patch).toEqual({ width: 100 });
    expect(containerDriven.diagnostics).toHaveLength(0);
  });

  it("deletes main-axis flex when fixing the size", () => {
    const { patch } = repairFlexSizing(
      { width: 100 },
      { style: { flex: 1 }, parent: { direction: "row", alignItems: "stretch" } },
    );
    expect(patch).toEqual({ width: 100, flex: undefined });
  });

  it("does nothing without a flex parent", () => {
    const input = { width: 100 };
    const { patch } = repairFlexSizing(input, { style: { flex: 1 }, parent: null });
    expect(patch).toBe(input);
  });
});

describe("validateStylePatch", () => {
  it("surfaces unknown fields the document would silently strip", () => {
    const diagnostics = validateStylePatch("view", { borderRadius: 8 });
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]?.code).toBe("unknown-field");
  });

  it("surfaces node-type-illegal fields (text has no gap)", () => {
    expect(validateStylePatch("text", { gap: 8 })[0]?.code).toBe("unknown-field");
    expect(validateStylePatch("view", { gap: 8 })).toHaveLength(0);
  });

  it("rejects wrong value families and out-of-enum literals", () => {
    expect(validateStylePatch("view", { width: "100px" })[0]?.code).toBe("invalid-value");
    expect(validateStylePatch("view", { flexDirection: "row-reverse" })[0]?.code).toBe(
      "invalid-value",
    );
    expect(validateStylePatch("view", { flexDirection: "row" })).toHaveLength(0);
  });

  it("rejects non-RGBA color strings via the schema regex", () => {
    expect(validateStylePatch("view", { backgroundColor: "#fff" })[0]?.code).toBe(
      "constraint-violation",
    );
    expect(validateStylePatch("view", { backgroundColor: "rgba(1, 2, 3, 0.5)" })).toHaveLength(0);
  });

  it("accepts deletions for any legal field", () => {
    expect(validateStylePatch("view", { flex: undefined, minWidth: undefined })).toHaveLength(0);
  });
});
