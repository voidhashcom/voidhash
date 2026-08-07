/**
 * Contract test for the stateful MCP editing manifest: the advertised tool set,
 * each descriptor's JSON Schema shape, and that a validated tool's dispatcher
 * folds an invalid-argument call into an `isError` tool result (never a throw).
 */
import { Context, Effect } from "effect";
import { describe, expect, it } from "vite-plus/test";

import { findMcpTool, MCP_TOOLS, mcpToolDescriptors, type JsonSchema } from "./tool-manifest.ts";
import type { WorkspaceToolDeps, WorkspaceToolResult } from "../ai/workspace-tools.ts";

/**
 * Argument validation fails before a dispatcher touches any workspace service,
 * so these cases run against an intentionally empty service map rather than a
 * full stub graph. Reaching a service here would surface as a runtime miss.
 */
const emptyWorkspaceServices = Context.makeUnsafe<WorkspaceToolDeps>(new Map());
const runDispatch = Effect.runPromiseWith(emptyWorkspaceServices);

const dispatchWith = (name: string, args: unknown): Promise<WorkspaceToolResult> =>
  runDispatch(findMcpTool(name)!.dispatch({ projectId: "proj_1" }, args));

const isString = (value: unknown): value is string => typeof value === "string";

const isRecord = (value: unknown): value is Record<string, unknown> => {
  if (value === null || Array.isArray(value)) return false;
  return typeof value === "object";
};

const requiredFields = (schema: JsonSchema): string[] => {
  const required = schema.required;
  if (!Array.isArray(required)) return [];
  return required.filter(isString);
};

const schemaProperties = (schema: JsonSchema): Record<string, unknown> => {
  const properties = schema.properties;
  if (!isRecord(properties)) return {};
  return properties;
};

const propertyType = (schema: JsonSchema, name: string): unknown => {
  const property = schemaProperties(schema)[name];
  if (!isRecord(property)) return undefined;
  return property.type;
};

describe("MCP tool manifest", () => {
  it("advertises the document-first tool set", () => {
    const names = mcpToolDescriptors().map((d) => d.name);
    expect(names).toEqual([
      "list_paywalls",
      "bash",
      "begin_paywall_edit",
      "get_paywall",
      "get_components",
      "read_component",
      "edit_paywall",
      "duplicate_subtree",
      "write_component",
      "rename_component",
      "delete_component",
      "get_paywall_preview",
      "finish_paywall_edit",
      "revert_paywall_edit",
    ]);
  });

  it("no longer advertises the deleted stateless-build tools", () => {
    const names = mcpToolDescriptors().map((d) => d.name);
    for (const removed of [
      "read_file",
      "get_diagnostics",
      "validate_paywall",
      "apply_paywall",
    ]) {
      expect(names).not.toContain(removed);
    }
  });

  it("bash requires a non-empty command", () => {
    const tool = findMcpTool("bash")!;
    expect(tool.descriptor.inputSchema.required).toEqual(["command"]);
    return dispatchWith("bash", { command: "" }).then((result) => {
      expect(result.isError).toBe(true);
      expect(result.output).toContain("invalid arguments");
    });
  });

  it("every descriptor has an object JSON Schema with a description", () => {
    for (const { descriptor } of MCP_TOOLS) {
      expect(descriptor.description.length).toBeGreaterThan(0);
      expect(descriptor.inputSchema.type).toBe("object");
    }
  });

  it("list_paywalls takes no input (empty object schema)", () => {
    const tool = findMcpTool("list_paywalls");
    expect(tool?.descriptor.inputSchema.properties).toEqual({});
  });

  it("list_paywalls rejects unexpected input", () =>
    dispatchWith("list_paywalls", { paywallId: "pw_1" }).then((result) => {
      expect(result.isError).toBe(true);
      expect(result.output).toContain("invalid arguments");
    }));

  it("get_paywall requires an edit session and allows nodeId + depth", () => {
    const schema = findMcpTool("get_paywall")!.descriptor.inputSchema;
    expect(requiredFields(schema).sort()).toEqual(["editSessionId"]);
    const props = schemaProperties(schema);
    expect(props).toHaveProperty("nodeId");
    expect(props).toHaveProperty("depth");
  });

  it("edit_paywall requires an edit session + a non-empty edits array", () => {
    const schema = findMcpTool("edit_paywall")!.descriptor.inputSchema;
    const required = requiredFields(schema);
    expect(required).toContain("editSessionId");
    expect(required).toContain("edits");
    expect(propertyType(schema, "edits")).toBe("array");
  });

  it("write_component requires editSessionId + path + source", () => {
    const schema = findMcpTool("write_component")!.descriptor.inputSchema;
    expect(requiredFields(schema).sort()).toEqual(["editSessionId", "path", "source"]);
  });

  it("rename_component requires editSessionId + fromPath + toPath", () => {
    const schema = findMcpTool("rename_component")!.descriptor.inputSchema;
    expect(requiredFields(schema).sort()).toEqual(["editSessionId", "fromPath", "toPath"]);
  });

  it("advertises the explicit preview-gated lifecycle", () => {
    expect(requiredFields(findMcpTool("begin_paywall_edit")!.descriptor.inputSchema)).toEqual([
      "paywallId",
    ]);
    const previewRequired = requiredFields(
      findMcpTool("get_paywall_preview")!.descriptor.inputSchema,
    );
    expect(previewRequired.sort()).toEqual(["editSessionId"]);
    const finishRequired = requiredFields(
      findMcpTool("finish_paywall_edit")!.descriptor.inputSchema,
    );
    expect(finishRequired).toEqual(
      expect.arrayContaining(["editSessionId", "reviewedDocumentSignature", "verdict"]),
    );
  });

  it("a validated tool folds invalid arguments into an isError result (no throw)", () =>
    // Missing required `edits` — the dispatcher validates and folds the failure.
    dispatchWith("edit_paywall", { editSessionId: "pw_edit_1" }).then((result) => {
      expect(result.isError).toBe(true);
      expect(result.output).toContain("invalid arguments");
    }));

  it("rejects redundant paywallId arguments after a session is opened", () =>
    dispatchWith("get_paywall", { editSessionId: "pw_edit_1", paywallId: "pw_1" }).then(
      (result) => {
        expect(result.isError).toBe(true);
        expect(result.output).toContain("invalid arguments");
      },
    ));
});
