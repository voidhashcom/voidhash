/**
 * Contract test for the stateless MCP tool manifest: the advertised tool set,
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
      "get_paywall",
      "get_components",
      "read_component",
      "edit_paywall",
      "write_component",
      "rename_component",
      "delete_component",
    ]);
  });

  it("no longer advertises the deleted stateless-build / bash tools", () => {
    const names = mcpToolDescriptors().map((d) => d.name);
    for (const removed of ["bash", "read_file", "get_diagnostics", "validate_paywall", "apply_paywall"]) {
      expect(names).not.toContain(removed);
    }
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

  it("get_paywall requires a slug and allows nodeId + depth", () => {
    const schema = findMcpTool("get_paywall")!.descriptor.inputSchema;
    expect((schema.required as string[]).sort()).toEqual(["slug"]);
    const props = schema.properties as Record<string, unknown>;
    expect(props).toHaveProperty("nodeId");
    expect(props).toHaveProperty("depth");
  });

  it("edit_paywall requires a slug + a non-empty edits array", () => {
    const schema = findMcpTool("edit_paywall")!.descriptor.inputSchema;
    const required = (schema.required as string[] | undefined) ?? [];
    expect(required).toContain("slug");
    expect(required).toContain("edits");
    const edits = (schema.properties as Record<string, { type?: string }>).edits;
    expect(edits.type).toBe("array");
  });

  it("write_component requires slug + path + source", () => {
    const schema = findMcpTool("write_component")!.descriptor.inputSchema;
    const required = ((schema.required as string[] | undefined) ?? []).sort();
    expect(required).toEqual(["path", "slug", "source"]);
  });

  it("rename_component requires slug + fromPath + toPath", () => {
    const schema = findMcpTool("rename_component")!.descriptor.inputSchema;
    const required = ((schema.required as string[] | undefined) ?? []).sort();
    expect(required).toEqual(["fromPath", "slug", "toPath"]);
  });

  it("a validated tool folds invalid arguments into an isError result (no throw)", async () => {
    const tool = findMcpTool("edit_paywall")!;
    const result = await Effect.runPromise(
      // Missing required `edits` — the dispatcher validates and folds the failure.
      tool.dispatch({ projectId: "proj_1" }, { slug: "trial" }) as Effect.Effect<
        { output: string; isError: boolean }
      >,
    );
    expect(result.isError).toBe(true);
    expect(result.output).toContain("invalid arguments");
  });
});
