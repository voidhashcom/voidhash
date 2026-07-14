/**
 * Tests the MCP tool DISPATCH path end-to-end through the stateless document-
 * first workspace-tool core against a mocked workspace context. Proves: a valid
 * call runs the core and returns its string; an invalid argument set folds to an
 * `isError` result (never a throw / JSON-RPC error); `list_paywalls` lists
 * directories; `get_paywall` cleans the document; `edit_paywall` validates then
 * applies; the write folds a rejection into a clean message (no Cause/_tag leak).
 */
import {
  ComponentCompiler,
  ComponentManifestCacheService,
  PaywallArtifactStore,
  PaywallDeployService,
  PaywallEditChangeSetService,
  PaywallWorkspaceService,
  SnapshotImageRenderer,
} from "@voidhash/core/services";
import { AuthSession } from "@voidhash/core/domain/auth/Auth";
import { Context, Effect } from "effect";
import { describe, expect, it } from "vite-plus/test";

import { findMcpTool } from "./tool-manifest.ts";
import type { WorkspaceToolResult } from "../ai/workspace-tools.ts";

/** A decoded document root: root → screen. */
const documentRoot = {
  id: "root1",
  type: "root",
  parentId: null,
  pos: "a0",
  data: { name: "Paywall" },
  children: [
    { id: "screen1", type: "screen", parentId: "root1", pos: "a0", data: {}, children: [] },
  ],
};

const fakeWorkspace = (over: Partial<PaywallWorkspaceService["Service"]> = {}) =>
  ({
    listPaywalls: () =>
      Effect.succeed([
        { slug: "trial", paywallId: "pw_1" },
        { slug: "onboarding", paywallId: "pw_2" },
      ]),
    readDocument: (_p: string, slug: string) =>
      Effect.succeed({ slug, name: "Trial", paywallId: "pw_1", root: documentRoot }),
    editDocument: () => Effect.succeed({ version: 9, commandCount: 2, mintedIds: {} }),
    writeComponentSource: () => Effect.succeed({ version: 9, commandCount: 1, diagnostics: [] }),
    moveComponentFile: () => Effect.succeed({ version: 9, commandCount: 1, diagnostics: [] }),
    deleteComponentFile: () => Effect.succeed({ version: 9, commandCount: 1, diagnostics: [] }),
    ...over,
  }) as unknown as PaywallWorkspaceService["Service"];

const fakeDeploy = (over: Partial<PaywallDeployService["Service"]> = {}) =>
  ({
    listComponents: () => Effect.succeed([]),
    ...over,
  }) as unknown as PaywallDeployService["Service"];

const fakeManifestCache = (over: Partial<ComponentManifestCacheService["Service"]> = {}) =>
  ({
    getMany: () => Effect.succeed(new Map()),
    record: () => Effect.void,
    ...over,
  }) as unknown as ComponentManifestCacheService["Service"];

const fakeCompiler = (over: Partial<ComponentCompiler["Service"]> = {}) =>
  ({
    compileCheck: () => Effect.succeed({ status: "unavailable" as const }),
    compileAndExtract: () => Effect.succeed({ status: "unavailable" as const }),
    ...over,
  }) as unknown as ComponentCompiler["Service"];

const fakeChangeSets = () =>
  ({
    requireActive: () =>
      Effect.succeed({
        id: "pw_change_1",
        projectId: "proj_1",
        paywallId: "pw_1",
        paywallSlug: "trial",
        baselineVersion: 1,
      }),
  }) as unknown as PaywallEditChangeSetService["Service"];

interface Fakes {
  readonly workspace?: PaywallWorkspaceService["Service"];
  readonly deploy?: PaywallDeployService["Service"];
  readonly manifestCache?: ComponentManifestCacheService["Service"];
  readonly compiler?: ComponentCompiler["Service"];
}

const contextWith = (fakes: Fakes) =>
  Context.empty().pipe(
    Context.add(PaywallWorkspaceService, fakes.workspace ?? fakeWorkspace()),
    Context.add(PaywallDeployService, fakes.deploy ?? fakeDeploy()),
    Context.add(ComponentManifestCacheService, fakes.manifestCache ?? fakeManifestCache()),
    Context.add(ComponentCompiler, fakes.compiler ?? fakeCompiler()),
    Context.add(PaywallEditChangeSetService, fakeChangeSets()),
    Context.add(PaywallArtifactStore, {
      getObject: () => Effect.succeed(null),
    } as unknown as PaywallArtifactStore["Service"]),
    Context.add(SnapshotImageRenderer, {
      render: () => Effect.succeed(new Uint8Array([1])),
    } as SnapshotImageRenderer["Service"]),
    Context.add(AuthSession, {} as never),
  );

const dispatchWith = (fakes: Fakes, name: string, args: unknown): Promise<WorkspaceToolResult> => {
  const tool = findMcpTool(name);
  if (tool === undefined) {
    throw new Error(`tool ${name} not found`);
  }
  return Effect.runPromise(
    tool.dispatch({ projectId: "proj_1" }, args).pipe(Effect.provide(contextWith(fakes))),
  );
};

const dispatch = (name: string, args: unknown): Promise<WorkspaceToolResult> =>
  dispatchWith({}, name, args);

describe("MCP tool dispatch", () => {
  it("list_paywalls lists the project directories (no input)", async () => {
    const result = await dispatch("list_paywalls", {});
    expect(result.isError).toBe(false);
    expect(result.output).toContain("trial (/paywalls/trial)");
    expect(result.output).toContain("onboarding (/paywalls/onboarding)");
  });

  it("get_paywall returns the cleaned document JSON with node ids", async () => {
    const result = await dispatch("get_paywall", { slug: "trial" });
    expect(result.isError).toBe(false);
    expect(result.output).toContain('"id": "root1"');
    expect(result.output).toContain('"type": "screen"');
  });

  it("edit_paywall validates then applies, reporting the new version", async () => {
    const result = await dispatch("edit_paywall", {
      slug: "trial",
      changeSetId: "pw_change_1",
      edits: [{ op: "insert", parentId: "screen1", node: { type: "view" } }],
    });
    expect(result.isError).toBe(false);
    expect(result.output).toContain("version 9");
  });

  it("edit_paywall returns structured validation errors verbatim (no apply)", async () => {
    const editDocument = () => {
      throw new Error("editDocument must not be called on a validation failure");
    };
    const result = await dispatchWith(
      { workspace: fakeWorkspace({ editDocument: editDocument as never }) },
      "edit_paywall",
      // Unknown parent id → validation rejects before any submit.
      {
        slug: "trial",
        changeSetId: "pw_change_1",
        edits: [{ op: "insert", parentId: "ghost", node: { type: "view" } }],
      },
    );
    expect(result.isError).toBe(true);
    expect(result.output).toContain("edit_paywall rejected");
    expect(result.output).toContain("ghost");
  });

  it("write_component rejects broken source with diagnostics (commits nothing)", async () => {
    const writeComponentSource = () => {
      throw new Error("writeComponentSource must not be called on a compile error");
    };
    const result = await dispatchWith(
      {
        workspace: fakeWorkspace({ writeComponentSource: writeComponentSource as never }),
        compiler: fakeCompiler({
          compileAndExtract: () =>
            Effect.succeed({
              status: "error" as const,
              phase: "compile" as const,
              diagnostics: [{ message: "Unexpected token", line: 3 }],
            }),
        }),
      },
      "write_component",
      {
        slug: "trial",
        changeSetId: "pw_change_1",
        path: "components/hero.tsx",
        source: "export default (=> {",
      },
    );
    expect(result.isError).toBe(true);
    expect(result.output).toContain("write_component rejected");
    expect(result.output).toContain("Unexpected token");
  });

  it("write_component commits a clean component and records its manifest", async () => {
    const recorded: unknown[] = [];
    const manifest = {
      manifestVersion: 2 as const,
      props: {},
      actions: {},
      slot: false,
      previewStates: ["default"],
      hostData: [],
    };
    const result = await dispatchWith(
      {
        manifestCache: fakeManifestCache({
          record: ((input: unknown) => Effect.sync(() => void recorded.push(input))) as never,
        }),
        compiler: fakeCompiler({
          compileAndExtract: () =>
            Effect.succeed({ status: "ready" as const, manifest, previewTrees: {} }),
        }),
      },
      "write_component",
      {
        slug: "trial",
        changeSetId: "pw_change_1",
        path: "components/hero.tsx",
        source: "export default () => null;",
      },
    );
    expect(result.isError).toBe(false);
    expect(result.output).toContain("version 9");
    expect(result.output).toContain("manifest recorded");
    expect(recorded).toHaveLength(1);
  });

  it("folds invalid arguments into an isError result (never throws)", async () => {
    const result = await dispatch("get_paywall", {});
    expect(result.isError).toBe(true);
    expect(result.output).toContain("get_paywall: invalid arguments");
  });

  it("folds an edit rejection into an isError result with a CLEAN message (no Cause/_tag leak)", async () => {
    const result = await dispatchWith(
      {
        workspace: fakeWorkspace({
          editDocument: () =>
            Effect.fail({
              _tag: "WorkspaceWriteConflictError",
              message: "lost the concurrency race",
            }) as never,
        }),
      },
      "edit_paywall",
      {
        slug: "trial",
        changeSetId: "pw_change_1",
        edits: [{ op: "insert", parentId: "screen1", node: { type: "view" } }],
      },
    );
    expect(result.isError).toBe(true);
    expect(result.output).toContain("edit_paywall rejected: lost the concurrency race");
    expect(result.output).not.toContain("Cause(");
    expect(result.output).not.toContain("_tag");
  });
});
