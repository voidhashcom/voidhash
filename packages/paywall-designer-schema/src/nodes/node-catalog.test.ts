import { describe, expect, it } from "vitest";

import {
  ALLOWED_CHILDREN_BY_NODE_TYPE,
  EDITABLE_NODE_TYPES,
  NODE_TYPES,
  canBeChildOf,
  canCreateLayoutChildren,
  canHaveChildren,
  isEditableNodeType,
  isNodeType,
} from "./node-catalog";

describe("node-catalog", () => {
  it("exposes expected node type sets", () => {
    expect(NODE_TYPES).toEqual(["root", "screen", "flex", "text", "shape", "path"]);
    expect(EDITABLE_NODE_TYPES).toEqual(["screen", "flex", "text", "shape", "path"]);
  });

  it("validates node types", () => {
    expect(isNodeType("root")).toBe(true);
    expect(isNodeType("shape")).toBe(true);
    expect(isNodeType("foo")).toBe(false);

    expect(isEditableNodeType("screen")).toBe(true);
    expect(isEditableNodeType("path")).toBe(true);
    expect(isEditableNodeType("root")).toBe(false);
  });

  it("applies allowed child rules", () => {
    expect(ALLOWED_CHILDREN_BY_NODE_TYPE.root).toEqual(["screen"]);
    expect(ALLOWED_CHILDREN_BY_NODE_TYPE.shape).toEqual(["path"]);

    expect(canBeChildOf("screen", "root")).toBe(true);
    expect(canBeChildOf("flex", "screen")).toBe(true);
    expect(canBeChildOf("text", "flex")).toBe(true);
    expect(canBeChildOf("shape", "screen")).toBe(true);
    expect(canBeChildOf("path", "shape")).toBe(true);

    expect(canBeChildOf("shape", "shape")).toBe(false);
    expect(canBeChildOf("path", "screen")).toBe(false);
    expect(canBeChildOf("screen", "flex")).toBe(false);
    expect(canBeChildOf("foo", "screen")).toBe(false);
    expect(canBeChildOf("text", "foo")).toBe(false);
  });

  it("exposes container capabilities", () => {
    expect(canHaveChildren("root")).toBe(true);
    expect(canHaveChildren("screen")).toBe(true);
    expect(canHaveChildren("flex")).toBe(true);
    expect(canHaveChildren("shape")).toBe(true);
    expect(canHaveChildren("text")).toBe(false);
    expect(canHaveChildren("path")).toBe(false);
    expect(canHaveChildren("unknown")).toBe(false);
  });

  it("limits layout primitive creation to screen and flex", () => {
    expect(canCreateLayoutChildren("screen")).toBe(true);
    expect(canCreateLayoutChildren("flex")).toBe(true);
    expect(canCreateLayoutChildren("shape")).toBe(false);
    expect(canCreateLayoutChildren("root")).toBe(false);
    expect(canCreateLayoutChildren("path")).toBe(false);
    expect(canCreateLayoutChildren("unknown")).toBe(false);
  });
});
