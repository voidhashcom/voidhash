import { describe, expect, test } from "vite-plus/test";

import {
  componentBoundActionFromRaw,
  componentPropBindingFromRaw,
  componentPropValueFromRaw,
  findComponentActionEntry,
  findComponentPropEntry,
  manifestDefaultPropValue,
  readBooleanArray,
  readNumberArray,
  readStringArray,
  scalarVariableTypeKeyForProp,
  unwrapScalarArray,
} from "./component-prop-values";

describe("unwrapScalarArray", () => {
  test("passes plain scalar arrays through", () => {
    expect(unwrapScalarArray(["a", "b"])).toEqual(["a", "b"]);
  });

  test("unwraps {id, pos, value} entry-wrapped arrays", () => {
    expect(
      unwrapScalarArray([
        { id: "e1", pos: "a1", value: "a" },
        { id: "e2", pos: "a2", value: "b" },
      ]),
    ).toEqual(["a", "b"]);
  });

  test("returns an empty array for non-arrays", () => {
    expect(unwrapScalarArray(undefined)).toEqual([]);
    expect(unwrapScalarArray({ value: "x" })).toEqual([]);
  });
});

describe("typed array readers", () => {
  test("filter out mismatched item types", () => {
    expect(readStringArray(["a", 1, true, "b"])).toEqual(["a", "b"]);
    expect(readNumberArray([{ id: "e", pos: "a", value: 2 }, "x", 3])).toEqual([2, 3]);
    expect(readBooleanArray([true, "true", false])).toEqual([true, false]);
  });
});

describe("componentPropValueFromRaw", () => {
  test("reads scalar values", () => {
    expect(componentPropValueFromRaw({ key: "string", value: "hi" })).toEqual({
      key: "string",
      value: "hi",
    });
    expect(componentPropValueFromRaw({ key: "number", value: 4 })).toEqual({
      key: "number",
      value: 4,
    });
    expect(componentPropValueFromRaw({ key: "boolean", value: false })).toEqual({
      key: "boolean",
      value: false,
    });
    expect(componentPropValueFromRaw({ key: "product", value: { productId: "p-1" } })).toEqual({
      key: "product",
      value: { productId: "p-1" },
    });
    // null (legacy stored shape) and absence both normalize to "no product"
    expect(componentPropValueFromRaw({ key: "product", value: { productId: null } })).toEqual({
      key: "product",
      value: {},
    });
    expect(componentPropValueFromRaw({ key: "product", value: {} })).toEqual({
      key: "product",
      value: {},
    });
  });

  test("rejects mismatched scalar payloads", () => {
    expect(componentPropValueFromRaw({ key: "string", value: 4 })).toBeUndefined();
    expect(componentPropValueFromRaw({ key: "product", value: { productId: 4 } })).toBeUndefined();
    expect(componentPropValueFromRaw({ key: "unknown", value: "x" })).toBeUndefined();
  });

  test("normalizes wrapped inner arrays to plain arrays", () => {
    expect(
      componentPropValueFromRaw({
        key: "string-array",
        value: [{ id: "e1", pos: "a1", value: "a" }],
      }),
    ).toEqual({ key: "string-array", value: ["a"] });
    expect(componentPropValueFromRaw({ key: "number-array", value: [1, 2] })).toEqual({
      key: "number-array",
      value: [1, 2],
    });
  });
});

describe("componentPropBindingFromRaw", () => {
  test("reads literal and variable-reference bindings", () => {
    expect(
      componentPropBindingFromRaw({
        type: "literal",
        value: { key: "boolean", value: true },
      }),
    ).toEqual({ type: "literal", value: { key: "boolean", value: true } });
    expect(
      componentPropBindingFromRaw({ type: "variable-reference", value: { id: "v-1" } }),
    ).toEqual({ type: "variable-reference", value: { id: "v-1" } });
  });

  test("rejects unknown shapes", () => {
    expect(componentPropBindingFromRaw(null)).toBeUndefined();
    expect(
      componentPropBindingFromRaw({ type: "literal", value: { key: "nope" } }),
    ).toBeUndefined();
    expect(componentPropBindingFromRaw({ type: "variable-reference", value: {} })).toBeUndefined();
  });
});

describe("componentBoundActionFromRaw", () => {
  test("reads every action variant", () => {
    expect(componentBoundActionFromRaw({ type: "none" })).toEqual({ type: "none" });
    expect(componentBoundActionFromRaw({ type: "close-paywall" })).toEqual({
      type: "close-paywall",
    });
    expect(
      componentBoundActionFromRaw({
        payload: {
          newValue: { type: "literal", value: { key: "string", value: "x" } },
          variableId: "v-1",
        },
        type: "set-variable",
      }),
    ).toEqual({
      payload: {
        newValue: { type: "literal", value: { key: "string", value: "x" } },
        variableId: "v-1",
      },
      type: "set-variable",
    });
    expect(
      componentBoundActionFromRaw({
        payload: { field: "productId", type: "action-payload" },
        type: "purchase-product",
      }),
    ).toEqual({
      payload: { field: "productId", type: "action-payload" },
      type: "purchase-product",
    });
  });

  test("reads action-payload value sources on set-variable", () => {
    expect(
      componentBoundActionFromRaw({
        payload: {
          newValue: { type: "action-payload", value: { field: "amount" } },
          variableId: "v-1",
        },
        type: "set-variable",
      }),
    ).toEqual({
      payload: {
        newValue: { type: "action-payload", value: { field: "amount" } },
        variableId: "v-1",
      },
      type: "set-variable",
    });
  });

  test("rejects malformed actions", () => {
    expect(componentBoundActionFromRaw(undefined)).toBeUndefined();
    expect(componentBoundActionFromRaw({ type: "set-variable", payload: {} })).toBeUndefined();
    expect(
      componentBoundActionFromRaw({
        payload: {
          newValue: { type: "literal", value: { key: "string-array", value: [] } },
          variableId: "v-1",
        },
        type: "set-variable",
      }),
    ).toBeUndefined();
  });
});

describe("entry finders", () => {
  const props = [
    {
      id: "p-1",
      pos: "a1",
      value: { name: "title", value: { type: "literal", value: { key: "string", value: "x" } } },
    },
  ];
  const actionBindings = [
    {
      id: "ab-1",
      pos: "a1",
      value: { action: { type: "close-paywall" }, name: "onSelect" },
    },
  ];

  test("find entries by name and expose the entry id", () => {
    expect(findComponentPropEntry(props, "title")).toMatchObject({ entryId: "p-1" });
    expect(findComponentPropEntry(props, "missing")).toBeUndefined();
    expect(findComponentActionEntry(actionBindings, "onSelect")).toMatchObject({
      entryId: "ab-1",
      raw: { type: "close-paywall" },
    });
    expect(findComponentActionEntry(actionBindings, "other")).toBeUndefined();
  });
});

describe("manifestDefaultPropValue", () => {
  test("maps storable defaults per kind", () => {
    expect(manifestDefaultPropValue({ default: "x", kind: "string" })).toEqual({
      key: "string",
      value: "x",
    });
    expect(
      manifestDefaultPropValue({ default: "dark", kind: "select", options: ["light", "dark"] }),
    ).toEqual({ key: "string", value: "dark" });
    expect(
      manifestDefaultPropValue({ default: ["a", 1], item: { kind: "string" }, kind: "array" }),
    ).toEqual({ key: "string-array", value: ["a"] });
  });

  test("returns undefined for kinds without storable defaults", () => {
    expect(manifestDefaultPropValue({ kind: "string" })).toBeUndefined();
    expect(manifestDefaultPropValue({ kind: "ref", refType: "product" })).toBeUndefined();
    expect(manifestDefaultPropValue({ kind: "component" })).toBeUndefined();
    expect(
      manifestDefaultPropValue({ default: [], item: { kind: "component" }, kind: "array" }),
    ).toBeUndefined();
  });
});

describe("scalarVariableTypeKeyForProp", () => {
  test("maps scalar kinds to variable type keys", () => {
    expect(scalarVariableTypeKeyForProp({ kind: "string" })).toBe("string");
    expect(scalarVariableTypeKeyForProp({ kind: "select", options: ["a"] })).toBe("string");
    expect(scalarVariableTypeKeyForProp({ kind: "image" })).toBe("string");
    expect(scalarVariableTypeKeyForProp({ kind: "number" })).toBe("number");
    expect(scalarVariableTypeKeyForProp({ kind: "boolean" })).toBe("boolean");
    expect(scalarVariableTypeKeyForProp({ kind: "ref", refType: "product" })).toBe("product");
    expect(scalarVariableTypeKeyForProp({ kind: "component" })).toBeUndefined();
    expect(
      scalarVariableTypeKeyForProp({ item: { kind: "string" }, kind: "array" }),
    ).toBeUndefined();
  });
});
