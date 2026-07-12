import {
  ComponentCompiler,
  ComponentManifestCacheService,
  PaywallDeployService,
  PaywallWorkspaceService,
} from "@voidhash/core/services";
import { AuthSession } from "@voidhash/core/domain/auth/Auth";
import { Context, Effect } from "effect";
import { describe, expect, it } from "vite-plus/test";

import * as WorkspaceTools from "./workspace-tools.ts";

/**
 * Drive the STATELESS, document-first MCP workspace-tool core directly against a
 * mocked workspace/deploy/compiler context. These tools read the LIVE document
 * and edit it via mimic ops / component-path writes; every one folds an expected
 * service failure into a readable message rather than throwing.
 */

const SCOPE: WorkspaceTools.WorkspaceToolScope = { projectId: "proj_1" };

/** A decoded document root: root → screen → view(with a text), and a library with one component. */
const documentRoot = {
  id: "root1",
  type: "root",
  parentId: null,
  pos: "a0",
  data: { name: "Paywall" },
  children: [
    {
      id: "screen1",
      type: "screen",
      parentId: "root1",
      pos: "a0",
      data: {},
      children: [
        {
          id: "view1",
          type: "view",
          parentId: "screen1",
          pos: "a0",
          data: {},
          children: [
            { id: "text1", type: "text", parentId: "view1", pos: "a0", data: { text: "Hi" }, children: [] },
          ],
        },
      ],
    },
    {
      id: "lib1",
      type: "library",
      parentId: "root1",
      pos: "a1",
      data: {},
      children: [
        {
          id: "cc1",
          type: "codeComponent",
          parentId: "lib1",
          pos: "a0",
          data: { path: "components/hero.tsx", source: "export const Hero = () => null;" },
          children: [],
        },
      ],
    },
  ],
};

const fakeWorkspace = (over: Partial<PaywallWorkspaceService["Service"]> = {}) =>
  ({
    listPaywalls: () => Effect.succeed([{ slug: "trial", paywallId: "pw_1" }]),
    readDocument: (_p: string, slug: string) =>
      Effect.succeed({ slug, name: "Trial", paywallId: "pw_1", root: documentRoot }),
    editDocument: () => Effect.succeed({ version: 9, commandCount: 2, mintedIds: { "0": ["abc1234567"] } }),
    writeComponentSource: () => Effect.succeed({ version: 9, commandCount: 1, diagnostics: [] }),
    moveComponentFile: () => Effect.succeed({ version: 9, commandCount: 2, diagnostics: [] }),
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

interface Fakes {
  readonly workspace?: PaywallWorkspaceService["Service"];
  readonly deploy?: PaywallDeployService["Service"];
  readonly manifestCache?: ComponentManifestCacheService["Service"];
  readonly compiler?: ComponentCompiler["Service"];
}

const run = (
  effect: Effect.Effect<WorkspaceTools.WorkspaceToolResult, never, WorkspaceTools.WorkspaceToolDeps>,
  fakes: Fakes = {},
): Promise<WorkspaceTools.WorkspaceToolResult> =>
  Effect.runPromise(
    effect.pipe(
      Effect.provide(
        Context.empty().pipe(
          Context.add(PaywallWorkspaceService, fakes.workspace ?? fakeWorkspace()),
          Context.add(PaywallDeployService, fakes.deploy ?? fakeDeploy()),
          Context.add(ComponentManifestCacheService, fakes.manifestCache ?? fakeManifestCache()),
          Context.add(ComponentCompiler, fakes.compiler ?? fakeCompiler()),
          Context.add(AuthSession, {} as never),
        ),
      ),
    ),
  );

describe("MCP workspace tools (document-first)", () => {
  it("list_paywalls formats the project's paywalls", async () => {
    const result = await run(WorkspaceTools.listPaywalls(SCOPE));
    expect(result.isError).toBe(false);
    expect(result.output).toContain("trial");
    expect(result.output).toContain("/paywalls/trial");
  });

  it("get_paywall returns cleaned document JSON with node ids", async () => {
    const result = await run(WorkspaceTools.getPaywall(SCOPE, { slug: "trial" }));
    expect(result.isError).toBe(false);
    expect(result.output).toContain('"id": "root1"');
    expect(result.output).toContain('"id": "view1"');
  });

  it("get_paywall(nodeId) roots the tree at a subtree", async () => {
    const result = await run(WorkspaceTools.getPaywall(SCOPE, { slug: "trial", nodeId: "view1" }));
    expect(result.isError).toBe(false);
    expect(result.output).toContain('"id": "view1"');
    // The sibling library node is not under view1.
    expect(result.output).not.toContain('"id": "lib1"');
  });

  it("get_paywall errors on an unknown nodeId", async () => {
    const result = await run(WorkspaceTools.getPaywall(SCOPE, { slug: "trial", nodeId: "ghost" }));
    expect(result.isError).toBe(true);
    expect(result.output).toContain("no node");
  });

  it("get_components lists catalog + local components; a missing manifest is noted", async () => {
    const result = await run(WorkspaceTools.getComponents(SCOPE, { slug: "trial" }), {
      deploy: fakeDeploy({
        listComponents: () =>
          Effect.succeed([
            {
              slug: "pricing",
              title: "Pricing",
              latestVersion: 3,
              latest: { manifest: { props: {}, actions: {} }, previewStates: ["default"] },
              previousVersions: [],
              componentId: "pc_1",
            },
          ]) as never,
      }),
      // no cached manifest for the local component → "manifest unavailable" note
      manifestCache: fakeManifestCache({ getMany: () => Effect.succeed(new Map()) }),
    });
    expect(result.isError).toBe(false);
    expect(result.output).toContain("pricing");
    expect(result.output).toContain("components/hero.tsx");
    expect(result.output).toContain("manifest unavailable");
  });

  it("read_component returns the local component source", async () => {
    const result = await run(
      WorkspaceTools.readComponent(SCOPE, { slug: "trial", path: "components/hero.tsx" }),
    );
    expect(result.isError).toBe(false);
    expect(result.output).toBe("export const Hero = () => null;");
  });

  it("read_component errors on an unknown path and lists what is available", async () => {
    const result = await run(
      WorkspaceTools.readComponent(SCOPE, { slug: "trial", path: "components/ghost.tsx" }),
    );
    expect(result.isError).toBe(true);
    expect(result.output).toContain("components/hero.tsx");
  });

  it("edit_paywall validates then applies, returning minted ids", async () => {
    const result = await run(
      WorkspaceTools.editPaywall(SCOPE, {
        slug: "trial",
        edits: [{ op: "insert", parentId: "screen1", node: { type: "view" } }],
      }),
    );
    expect(result.isError).toBe(false);
    expect(result.output).toContain("version 9");
    expect(result.output).toContain("Minted ids");
    expect(result.output).toContain("abc1234567");
  });

  it("edit_paywall auto-derives backgroundEnabled from a lone backgroundColor", async () => {
    // The applied edits are what the workspace commits — capture them and assert the
    // group flag was injected by the shared validator's write-side normalization.
    let applied: unknown[] = [];
    const result = await run(
      WorkspaceTools.editPaywall(SCOPE, {
        slug: "trial",
        edits: [{ op: "update", nodeId: "view1", set: { style: { backgroundColor: "rgba(1, 2, 3, 1)" } } }],
      }),
      {
        workspace: fakeWorkspace({
          editDocument: ((_p: string, _slug: string, edits: unknown[]) => {
            applied = edits;
            return Effect.succeed({ version: 9, commandCount: 1, mintedIds: {} });
          }) as never,
        }),
      },
    );
    expect(result.isError).toBe(false);
    const set = (applied[0] as { set: { style: Record<string, unknown> } }).set;
    expect(set.style.backgroundEnabled).toBe(true);
    expect(set.style.backgroundColor).toBe("rgba(1, 2, 3, 1)");
  });

  it("edit_paywall returns structured validation errors and never applies", async () => {
    const editDocument = () => {
      throw new Error("editDocument must not run on a validation failure");
    };
    const result = await run(
      WorkspaceTools.editPaywall(SCOPE, {
        slug: "trial",
        // view cannot be a child of text → illegalChild
        edits: [{ op: "insert", parentId: "text1", node: { type: "view" } }],
      }),
      { workspace: fakeWorkspace({ editDocument: editDocument as never }) },
    );
    expect(result.isError).toBe(true);
    expect(result.output).toContain("edit_paywall rejected");
    expect(result.output).toContain("text");
  });

  it("edit_paywall folds a conflict into a clean message (no Cause/_tag leak)", async () => {
    const result = await run(
      WorkspaceTools.editPaywall(SCOPE, {
        slug: "trial",
        edits: [{ op: "update", nodeId: "text1", set: { text: "Bye" } }],
      }),
      {
        workspace: fakeWorkspace({
          editDocument: () =>
            Effect.fail({ _tag: "WorkspaceWriteConflictError", message: "race lost" }) as never,
        }),
      },
    );
    expect(result.isError).toBe(true);
    expect(result.output).toContain("edit_paywall rejected: race lost");
    expect(result.output).not.toContain("Cause(");
    expect(result.output).not.toContain("_tag");
  });

  it("write_component rejects a broken component with diagnostics (commits nothing)", async () => {
    const writeComponentSource = () => {
      throw new Error("must not commit on a compile error");
    };
    const result = await run(
      WorkspaceTools.writeComponent(SCOPE, {
        slug: "trial",
        path: "components/broken.tsx",
        source: "export default (=> {",
      }),
      {
        workspace: fakeWorkspace({ writeComponentSource: writeComponentSource as never }),
        compiler: fakeCompiler({
          compileAndExtract: () =>
            Effect.succeed({
              status: "error" as const,
              phase: "compile" as const,
              diagnostics: [{ message: "Unexpected token", line: 1, column: 17 }],
            }),
        }),
      },
    );
    expect(result.isError).toBe(true);
    expect(result.output).toContain("Unexpected token");
  });

  it("write_component commits a clean component and records its manifest", async () => {
    const recorded: unknown[] = [];
    const result = await run(
      WorkspaceTools.writeComponent(SCOPE, {
        slug: "trial",
        path: "components/card.tsx",
        source: "export default () => null;",
      }),
      {
        manifestCache: fakeManifestCache({
          record: ((input: unknown) => Effect.sync(() => void recorded.push(input))) as never,
        }),
        compiler: fakeCompiler({
          compileAndExtract: () =>
            Effect.succeed({
              status: "ready" as const,
              manifest: {
                manifestVersion: 2,
                props: {},
                actions: {},
                slot: false,
                previewStates: ["default"],
                hostData: [],
              },
            }),
        }),
      },
    );
    expect(result.isError).toBe(false);
    expect(result.output).toContain("manifest recorded");
    expect(recorded).toHaveLength(1);
  });

  it("write_component commits unvalidated when the compiler is unavailable (degraded workerd)", async () => {
    const result = await run(
      WorkspaceTools.writeComponent(SCOPE, {
        slug: "trial",
        path: "components/card.tsx",
        source: "export default () => null;",
      }),
      // default compiler is `unavailable`
    );
    expect(result.isError).toBe(false);
    expect(result.output).toContain("diagnostics unavailable");
  });

  it("write_component rejects an invalid file name before compiling", async () => {
    const compileAndExtract = () => {
      throw new Error("must not compile an invalid path");
    };
    const result = await run(
      WorkspaceTools.writeComponent(SCOPE, {
        slug: "trial",
        path: "components/../evil.tsx",
        source: "export default () => null;",
      }),
      { compiler: fakeCompiler({ compileAndExtract: compileAndExtract as never }) },
    );
    expect(result.isError).toBe(true);
    expect(result.output).toContain("write_component rejected");
  });

  it("rename_component moves a component and reports the version", async () => {
    const result = await run(
      WorkspaceTools.renameComponent(SCOPE, {
        slug: "trial",
        fromPath: "components/hero.tsx",
        toPath: "components/banner.tsx",
      }),
    );
    expect(result.isError).toBe(false);
    expect(result.output).toContain("components/hero.tsx → components/banner.tsx");
  });

  it("delete_component removes a component and warns about placeholders", async () => {
    const result = await run(
      WorkspaceTools.deleteComponent(SCOPE, { slug: "trial", path: "components/hero.tsx" }),
    );
    expect(result.isError).toBe(false);
    expect(result.output).toContain("placeholders");
  });

  it("a service failure folds into a readable message (no Cause leak)", async () => {
    const result = await run(WorkspaceTools.getPaywall(SCOPE, { slug: "missing" }), {
      workspace: fakeWorkspace({
        readDocument: () =>
          Effect.fail({ _tag: "PaywallNotFoundError", message: 'No paywall "missing"' }) as never,
      }),
    });
    expect(result.isError).toBe(true);
    expect(result.output).toContain("get_paywall failed");
    expect(result.output).toContain('No paywall "missing"');
    expect(result.output).not.toContain("Cause(");
  });
});
