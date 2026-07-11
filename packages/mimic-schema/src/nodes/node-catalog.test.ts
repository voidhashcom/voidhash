import { describe, expect, it } from "vite-plus/test";

import {
  ALLOWED_CHILDREN_BY_NODE_TYPE,
  EDITABLE_NODE_TYPES,
  NODE_TYPES,
  STATEFUL_NODE_TYPES,
  canBeChildOf,
  canCreateLayoutChildren,
  canHaveChildren,
  isEditableNodeType,
  isNodeType,
  isStatefulNodeType,
} from "./node-catalog.ts";

describe("node-catalog", () => {
  it("exposes expected node type sets", () => {
    expect(NODE_TYPES).toEqual([
      "root",
      "screen",
      "view",
      "scrollView",
      "text",
      "shape",
      "path",
      "component",
      "library",
      "codeComponent",
    ]);
    expect(EDITABLE_NODE_TYPES).toEqual([
      "screen",
      "view",
      "scrollView",
      "text",
      "shape",
      "path",
      "component",
    ]);
    expect(STATEFUL_NODE_TYPES).toEqual(["screen", "view", "scrollView", "text", "shape", "path"]);
  });

  it("validates node types", () => {
    expect(isNodeType("root")).toBe(true);
    expect(isNodeType("shape")).toBe(true);
    expect(isNodeType("component")).toBe(true);
    expect(isNodeType("foo")).toBe(false);

    expect(isEditableNodeType("screen")).toBe(true);
    expect(isEditableNodeType("path")).toBe(true);
    expect(isEditableNodeType("component")).toBe(true);
    expect(isEditableNodeType("root")).toBe(false);
  });

  it("identifies stateful node types", () => {
    expect(isStatefulNodeType("screen")).toBe(true);
    expect(isStatefulNodeType("view")).toBe(true);
    expect(isStatefulNodeType("scrollView")).toBe(true);
    expect(isStatefulNodeType("text")).toBe(true);
    expect(isStatefulNodeType("shape")).toBe(true);
    expect(isStatefulNodeType("path")).toBe(true);
    expect(isStatefulNodeType("component")).toBe(false);
    expect(isStatefulNodeType("root")).toBe(false);
    expect(isStatefulNodeType("foo")).toBe(false);
  });

  it("applies allowed child rules", () => {
    expect(ALLOWED_CHILDREN_BY_NODE_TYPE.root).toEqual(["screen", "library"]);
    expect(ALLOWED_CHILDREN_BY_NODE_TYPE.screen).toEqual([
      "view",
      "scrollView",
      "text",
      "shape",
      "component",
    ]);
    expect(ALLOWED_CHILDREN_BY_NODE_TYPE.view).toEqual([
      "view",
      "scrollView",
      "text",
      "shape",
      "component",
    ]);
    expect(ALLOWED_CHILDREN_BY_NODE_TYPE.scrollView).toEqual([
      "view",
      "scrollView",
      "text",
      "shape",
      "component",
    ]);
    expect(ALLOWED_CHILDREN_BY_NODE_TYPE.shape).toEqual(["path"]);
    expect(ALLOWED_CHILDREN_BY_NODE_TYPE.component).toEqual([
      "view",
      "scrollView",
      "text",
      "shape",
      "component",
    ]);
    expect(ALLOWED_CHILDREN_BY_NODE_TYPE.library).toEqual(["codeComponent"]);
    expect(ALLOWED_CHILDREN_BY_NODE_TYPE.codeComponent).toEqual([]);

    expect(canBeChildOf("screen", "root")).toBe(true);
    expect(canBeChildOf("library", "root")).toBe(true);
    expect(canBeChildOf("codeComponent", "library")).toBe(true);
    expect(canBeChildOf("codeComponent", "screen")).toBe(false);
    expect(canBeChildOf("view", "screen")).toBe(true);
    expect(canBeChildOf("scrollView", "screen")).toBe(true);
    expect(canBeChildOf("scrollView", "view")).toBe(true);
    expect(canBeChildOf("view", "scrollView")).toBe(true);
    expect(canBeChildOf("scrollView", "scrollView")).toBe(true);
    expect(canBeChildOf("text", "scrollView")).toBe(true);
    expect(canBeChildOf("scrollView", "component")).toBe(true);
    expect(canBeChildOf("text", "view")).toBe(true);
    expect(canBeChildOf("shape", "screen")).toBe(true);
    expect(canBeChildOf("path", "shape")).toBe(true);
    expect(canBeChildOf("component", "screen")).toBe(true);
    expect(canBeChildOf("component", "view")).toBe(true);
    expect(canBeChildOf("component", "component")).toBe(true);
    expect(canBeChildOf("view", "component")).toBe(true);
    expect(canBeChildOf("text", "component")).toBe(true);
    expect(canBeChildOf("shape", "component")).toBe(true);

    expect(canBeChildOf("shape", "shape")).toBe(false);
    expect(canBeChildOf("path", "screen")).toBe(false);
    expect(canBeChildOf("screen", "view")).toBe(false);
    expect(canBeChildOf("component", "root")).toBe(false);
    expect(canBeChildOf("component", "shape")).toBe(false);
    expect(canBeChildOf("component", "text")).toBe(false);
    expect(canBeChildOf("path", "component")).toBe(false);
    expect(canBeChildOf("screen", "component")).toBe(false);
    expect(canBeChildOf("foo", "screen")).toBe(false);
    expect(canBeChildOf("text", "foo")).toBe(false);
  });

  it("exposes container capabilities", () => {
    expect(canHaveChildren("root")).toBe(true);
    expect(canHaveChildren("screen")).toBe(true);
    expect(canHaveChildren("view")).toBe(true);
    expect(canHaveChildren("scrollView")).toBe(true);
    expect(canHaveChildren("shape")).toBe(true);
    expect(canHaveChildren("component")).toBe(true);
    expect(canHaveChildren("text")).toBe(false);
    expect(canHaveChildren("path")).toBe(false);
    expect(canHaveChildren("unknown")).toBe(false);
  });

  it("limits layout primitive creation to screen, view and component", () => {
    expect(canCreateLayoutChildren("screen")).toBe(true);
    expect(canCreateLayoutChildren("view")).toBe(true);
    expect(canCreateLayoutChildren("scrollView")).toBe(true);
    expect(canCreateLayoutChildren("component")).toBe(true);
    expect(canCreateLayoutChildren("shape")).toBe(false);
    expect(canCreateLayoutChildren("root")).toBe(false);
    expect(canCreateLayoutChildren("path")).toBe(false);
    expect(canCreateLayoutChildren("unknown")).toBe(false);
  });
});
