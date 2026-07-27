/**
 * Contract test for the stateful MCP editing manifest: the advertised tool set,
 * each descriptor's JSON Schema shape, and that a validated tool's dispatcher
 * folds an invalid-argument call into an `isError` tool result (never a throw).
 */
import { Effect } from "effect";
import { describe, expect, it } from "vite-plus/test";

import { findMcpTool, MCP_TOOLS, mcpToolDescriptors } from "./tool-manifest.ts";

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

  it("bash requires a non-empty command", async () => {
    const tool = findMcpTool("bash")!;
    expect(tool.descriptor.inputSchema.required).toEqual(["command"]);
    const result = await Effect.runPromise(
      tool.dispatch({ projectId: "proj_1" }, { command: "" }) as Effect.Effect<{
        output: string;
        isError: boolean;
      }>,
    );
    expect(result.isError).toBe(true);
    expect(result.output).toContain("invalid arguments");
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

  it("list_paywalls rejects unexpected input", async () => {
    const tool = findMcpTool("list_paywalls")!;
    const result = await Effect.runPromise(
      tool.dispatch({ projectId: "proj_1" }, { paywallId: "pw_1" }) as Effect.Effect<{
        output: string;
        isError: boolean;
      }>,
    );
    expect(result.isError).toBe(true);
    expect(result.output).toContain("invalid arguments");
  });

  it("get_paywall requires an edit session and allows nodeId + depth", () => {
    const schema = findMcpTool("get_paywall")!.descriptor.inputSchema;
    expect((schema.required as string[]).sort()).toEqual(["editSessionId"]);
    const props = schema.properties as Record<string, unknown>;
    expect(props).toHaveProperty("nodeId");
    expect(props).toHaveProperty("depth");
  });

  it("edit_paywall requires an edit session + a non-empty edits array", () => {
    const schema = findMcpTool("edit_paywall")!.descriptor.inputSchema;
    const required = (schema.required as string[] | undefined) ?? [];
    expect(required).toContain("editSessionId");
    expect(required).toContain("edits");
    const edits = (schema.properties as Record<string, { type?: string }>).edits;
    expect(edits.type).toBe("array");
  });

  it("write_component requires editSessionId + path + source", () => {
    const schema = findMcpTool("write_component")!.descriptor.inputSchema;
    const required = ((schema.required as string[] | undefined) ?? []).sort();
    expect(required).toEqual(["editSessionId", "path", "source"]);
  });

  it("rename_component requires editSessionId + fromPath + toPath", () => {
    const schema = findMcpTool("rename_component")!.descriptor.inputSchema;
    const required = ((schema.required as string[] | undefined) ?? []).sort();
    expect(required).toEqual(["editSessionId", "fromPath", "toPath"]);
  });

  it("advertises the explicit preview-gated lifecycle", () => {
    expect(findMcpTool("begin_paywall_edit")!.descriptor.inputSchema.required as string[]).toEqual([
      "paywallId",
    ]);
    const previewRequired =
      (findMcpTool("get_paywall_preview")!.descriptor.inputSchema.required as string[]) ?? [];
    expect(previewRequired.sort()).toEqual(["editSessionId"]);
    const finishRequired =
      (findMcpTool("finish_paywall_edit")!.descriptor.inputSchema.required as string[]) ?? [];
    expect(finishRequired).toEqual(
      expect.arrayContaining(["editSessionId", "reviewedDocumentSignature", "verdict"]),
    );
  });

  it("a validated tool folds invalid arguments into an isError result (no throw)", async () => {
    const tool = findMcpTool("edit_paywall")!;
    const result = await Effect.runPromise(
      // Missing required `edits` — the dispatcher validates and folds the failure.
      tool.dispatch({ projectId: "proj_1" }, { editSessionId: "pw_edit_1" }) as Effect.Effect<{
        output: string;
        isError: boolean;
      }>,
    );
    expect(result.isError).toBe(true);
    expect(result.output).toContain("invalid arguments");
  });

  it("rejects redundant paywallId arguments after a session is opened", async () => {
    const tool = findMcpTool("get_paywall")!;
    const result = await Effect.runPromise(
      tool.dispatch(
        { projectId: "proj_1" },
        { editSessionId: "pw_edit_1", paywallId: "pw_1" },
      ) as Effect.Effect<{ output: string; isError: boolean }>,
    );
    expect(result.isError).toBe(true);
    expect(result.output).toContain("invalid arguments");
  });
});
