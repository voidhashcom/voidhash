import {
  ComponentCompiler,
  ComponentManifestCacheService,
  componentServingPreviewKey,
  PaywallArtifactStore,
  PaywallDeployService,
  PaywallEditSessionService,
  PaywallWorkspaceService,
  SnapshotImageRenderer,
  WorkspaceWriteConflictError,
} from "@voidhash/core/services";
import {
  ActionForbiddenError,
  AuthSession,
  makeInternalProjectAuthSession,
} from "@voidhash/core/domain/auth/Auth";
import { PaywallNotFoundError } from "@voidhash/core/domain/paywall/Paywall";
import { Context, DateTime, Effect, Schema } from "effect";
import { describe, expect, it } from "vite-plus/test";

import * as WorkspaceTools from "./workspace-tools.ts";

/**
 * Drive the stateful, document-first MCP workspace-tool core directly against a
 * mocked workspace/deploy/compiler context. These tools read and edit the live
 * document through an explicit edit-session connection; every one folds an
 * expected service failure into a readable message rather than throwing.
 */

const SCOPE: WorkspaceTools.WorkspaceToolScope = { projectId: "proj_1" };
const EDIT_SESSION_ID = "pw_edit_1";

const decodeJson = Schema.decodeUnknownSync(Schema.fromJsonString(Schema.Unknown));
const encodeJson = Schema.encodeSync(Schema.fromJsonString(Schema.Unknown));

/** A raw document node as the fake workspace hands it to the tools. */
interface FakeDocumentNode {
  readonly id: string;
  readonly type: string;
  readonly parentId: string | null;
  readonly pos: string;
  readonly data: Record<string, unknown>;
  readonly children: FakeDocumentNode[];
}

/**
 * A service method that no test exercises: calling it is a test-authoring
 * mistake, so it fails the run as a defect instead of returning a fake value.
 */
const notImplemented = (name: string) => () =>
  Effect.die(new Error(`${name} is not stubbed by this test`));

/** A decoded document root: root → screen → view(with a text), and a library with one component. */
const documentRoot: FakeDocumentNode = {
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
            {
              id: "text1",
              type: "text",
              parentId: "view1",
              pos: "a0",
              data: { text: "Hi" },
              children: [],
            },
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

const fakeWorkspace = (
  over: Partial<PaywallWorkspaceService["Service"]> = {},
): PaywallWorkspaceService["Service"] => ({
  listPaywalls: () => Effect.succeed([{ slug: "trial", paywallId: "pw_1" }]),
  readDocument: (_projectId, slug) =>
    Effect.succeed({
      slug,
      name: "Trial",
      paywallId: "pw_1",
      tree: { encoded: true },
      root: documentRoot,
      version: 8,
    }),
  readDocumentTree: (paywallId) => {
    if (paywallId === "pw_1") {
      return Effect.succeed({ tree: { encoded: true }, root: documentRoot, version: 8 });
    }
    return Effect.fail(new PaywallNotFoundError({ message: `No paywall with id "${paywallId}"` }));
  },
  readConnectedDocumentTree: () =>
    Effect.succeed({ tree: { encoded: true }, root: documentRoot, version: 8 }),
  editDocument: () =>
    Effect.succeed({ version: 9, commandCount: 2, mintedIds: { "0": ["abc1234567"] } }),
  editConnectedDocument: () =>
    Effect.succeed({ version: 9, commandCount: 2, mintedIds: { "0": ["abc1234567"] } }),
  writeComponentSource: () => Effect.succeed({ version: 9, commandCount: 1, diagnostics: [] }),
  writeConnectedComponentSource: () =>
    Effect.succeed({ version: 9, commandCount: 1, diagnostics: [] }),
  moveComponentFile: () => Effect.succeed({ version: 9, commandCount: 2, diagnostics: [] }),
  moveConnectedComponentFile: () =>
    Effect.succeed({ version: 9, commandCount: 2, diagnostics: [] }),
  deleteComponentFile: () => Effect.succeed({ version: 9, commandCount: 1, diagnostics: [] }),
  deleteConnectedComponentFile: () =>
    Effect.succeed({ version: 9, commandCount: 1, diagnostics: [] }),
  openDocumentConnection: notImplemented("openDocumentConnection"),
  heartbeatDocumentConnection: notImplemented("heartbeatDocumentConnection"),
  closeDocumentConnection: notImplemented("closeDocumentConnection"),
  revertDocument: notImplemented("revertDocument"),
  revertConnectedDocument: notImplemented("revertConnectedDocument"),
  ...over,
});

const fakeDeploy = (
  over: Partial<PaywallDeployService["Service"]> = {},
): PaywallDeployService["Service"] => ({
  listComponents: () => Effect.succeed([]),
  createDeploy: notImplemented("createDeploy"),
  finalizeDeploy: notImplemented("finalizeDeploy"),
  getComponentVersions: notImplemented("getComponentVersions"),
  listDeploys: notImplemented("listDeploys"),
  setActivePaywallRelease: notImplemented("setActivePaywallRelease"),
  uploadBlob: notImplemented("uploadBlob"),
  ...over,
});

const fakeManifestCache = (
  over: Partial<ComponentManifestCacheService["Service"]> = {},
): ComponentManifestCacheService["Service"] => ({
  getMany: () => Effect.succeed(new Map()),
  record: () => Effect.succeed(undefined),
  ...over,
});

const fakeCompiler = (
  over: Partial<ComponentCompiler["Service"]> = {},
): ComponentCompiler["Service"] => ({
  compileCheck: () => Effect.succeed({ status: "unavailable" }),
  compileAndExtract: () => Effect.succeed({ status: "unavailable" }),
  ...over,
});

const fakeEditSessions = (
  over: Partial<PaywallEditSessionService["Service"]> = {},
): PaywallEditSessionService["Service"] => ({
  begin: () =>
    Effect.succeed({
      editSessionId: EDIT_SESSION_ID,
      paywallId: "pw_1",
      baselineVersion: 8,
    }),
  connectActive: () =>
    Effect.succeed({
      editSessionId: EDIT_SESSION_ID,
      projectId: "proj_1",
      paywallId: "pw_1",
      paywallSlug: "trial",
      baselineVersion: 1,
    }),
  requireActive: () =>
    Effect.succeed({
      editSessionId: EDIT_SESSION_ID,
      projectId: "proj_1",
      paywallId: "pw_1",
      paywallSlug: "trial",
      baselineVersion: 1,
    }),
  recordPreview: () => Effect.void,
  recordMutation: () => Effect.void,
  finish: () => Effect.succeed({ editSessionId: EDIT_SESSION_ID, status: "finished" }),
  revert: () => Effect.succeed({ version: 9, commandCount: 2, paywallSlug: "trial" }),
  revertForAgentSession: notImplemented("revertForAgentSession"),
  ...over,
});

const fakeArtifactStore = (
  over: Partial<PaywallArtifactStore["Service"]> = {},
): PaywallArtifactStore["Service"] => ({
  bucketName: "test-bucket",
  getObject: () => Effect.succeed(null),
  putObject: notImplemented("putObject"),
  head: notImplemented("head"),
  ...over,
});

const fakeRenderer = (): SnapshotImageRenderer["Service"] => ({
  render: () => Effect.succeed(new Uint8Array([1, 2, 3])),
});

const TEST_SESSION = makeInternalProjectAuthSession({
  id: "proj_1",
  name: "Test project",
  organizationId: "org_1",
  slug: "test-project",
});

interface Fakes {
  readonly workspace?: PaywallWorkspaceService["Service"];
  readonly deploy?: PaywallDeployService["Service"];
  readonly manifestCache?: ComponentManifestCacheService["Service"];
  readonly compiler?: ComponentCompiler["Service"];
  readonly editSessions?: PaywallEditSessionService["Service"];
  readonly artifactStore?: PaywallArtifactStore["Service"];
  readonly renderer?: SnapshotImageRenderer["Service"];
}

const run = (
  effect: Effect.Effect<
    WorkspaceTools.WorkspaceToolResult,
    never,
    WorkspaceTools.WorkspaceToolDeps
  >,
  fakes: Fakes = {},
): Effect.Effect<WorkspaceTools.WorkspaceToolResult> =>
  effect.pipe(
    Effect.provide(
      Context.empty().pipe(
        Context.add(PaywallWorkspaceService, fakes.workspace ?? fakeWorkspace()),
        Context.add(PaywallDeployService, fakes.deploy ?? fakeDeploy()),
        Context.add(ComponentManifestCacheService, fakes.manifestCache ?? fakeManifestCache()),
        Context.add(ComponentCompiler, fakes.compiler ?? fakeCompiler()),
        Context.add(PaywallEditSessionService, fakes.editSessions ?? fakeEditSessions()),
        Context.add(PaywallArtifactStore, fakes.artifactStore ?? fakeArtifactStore()),
        Context.add(SnapshotImageRenderer, fakes.renderer ?? fakeRenderer()),
        Context.add(AuthSession, TEST_SESSION),
      ),
    ),
  );

describe("MCP workspace tools (document-first)", () => {
  it("begin_paywall_edit returns the edit-session capability and captured baseline", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const result = yield* run(WorkspaceTools.beginPaywallEdit(SCOPE, { paywallId: "pw_1" }));
        expect(result.isError, result.output).toBe(false);
        expect(result.output).toContain(EDIT_SESSION_ID);
        expect(decodeJson(result.output)).toMatchObject({
          baselineVersion: 8,
          paywallId: "pw_1",
        });
      }),
    ));

  it("list_paywalls formats the project's paywalls", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const result = yield* run(WorkspaceTools.listPaywalls(SCOPE));
        expect(result.isError, result.output).toBe(false);
        expect(result.output).toContain("trial");
        expect(result.output).toContain("/paywalls/trial");
      }),
    ));

  it("bash reads projected documents and component sources over the VFS", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const result = yield* run(
          WorkspaceTools.runBash(SCOPE, {
            command: "ls /paywalls && cat /paywalls/pw_1/components/hero.tsx",
          }),
        );
        expect(result.isError, result.output).toBe(false);
        expect(result.output).toContain("pw_1");
        expect(result.output).toContain("export const Hero");
      }),
    ));

  it("bash reports a non-zero exit code as a successful result", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const result = yield* run(
          WorkspaceTools.runBash(SCOPE, {
            command: "grep no-such-token /paywalls/pw_1/document.json",
          }),
        );
        expect(result.isError, result.output).toBe(false);
        expect(result.output).toContain("[exit code 1]");
      }),
    ));

  it("bash surfaces a workspace service failure as isError", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const result = yield* run(WorkspaceTools.runBash(SCOPE, { command: "ls /paywalls" }), {
          workspace: fakeWorkspace({
            listPaywalls: () => Effect.fail(new ActionForbiddenError({ message: "db down" })),
          }),
        });
        expect(result.isError).toBe(true);
        expect(result.output).toContain("db down");
      }),
    ));

  it("get_paywall returns cleaned document JSON with node ids", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const result = yield* run(
          WorkspaceTools.getPaywall(SCOPE, { editSessionId: EDIT_SESSION_ID }),
        );
        expect(result.isError).toBe(false);
        expect(result.output).toContain('"id": "root1"');
        expect(result.output).toContain('"id": "view1"');
      }),
    ));

  it("get_paywall(nodeId) roots the tree at a subtree", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const result = yield* run(
          WorkspaceTools.getPaywall(SCOPE, { editSessionId: EDIT_SESSION_ID, nodeId: "view1" }),
        );
        expect(result.isError).toBe(false);
        expect(result.output).toContain('"id": "view1"');
        // The sibling library node is not under view1.
        expect(result.output).not.toContain('"id": "lib1"');
      }),
    ));

  it("get_paywall errors on an unknown nodeId", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const result = yield* run(
          WorkspaceTools.getPaywall(SCOPE, { editSessionId: EDIT_SESSION_ID, nodeId: "ghost" }),
        );
        expect(result.isError).toBe(true);
        expect(result.output).toContain("no node");
      }),
    ));

  it("get_components lists catalog + local components; a missing manifest is noted", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const createdAt = yield* DateTime.nowAsDate;
        const result = yield* run(
          WorkspaceTools.getComponents(SCOPE, { editSessionId: EDIT_SESSION_ID }),
          {
            deploy: fakeDeploy({
              listComponents: () =>
                Effect.succeed([
                  {
                    slug: "pricing",
                    title: "Pricing",
                    latestVersion: 3,
                    latest: {
                      slug: "pricing",
                      version: 3,
                      contentHash: "hash-pricing",
                      manifest: { props: {}, actions: {} },
                      hasPanel: false,
                      previewStates: ["default"],
                      artifactBaseUrl: "https://cdn.test/c/hash-pricing",
                      createdAt,
                    },
                    previousVersions: [],
                    componentId: "pc_1",
                  },
                ]),
            }),
            // no cached manifest for the local component → "manifest unavailable" note
            manifestCache: fakeManifestCache({ getMany: () => Effect.succeed(new Map()) }),
          },
        );
        expect(result.isError).toBe(false);
        expect(result.output).toContain("pricing");
        expect(result.output).toContain("components/hero.tsx");
        expect(result.output).toContain("manifest unavailable");
        expect(result.output).toContain("Builtin components");
      }),
    ));

  it("read_component returns the local component source", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const result = yield* run(
          WorkspaceTools.readComponent(SCOPE, {
            editSessionId: EDIT_SESSION_ID,
            path: "components/hero.tsx",
          }),
        );
        expect(result.isError).toBe(false);
        expect(result.output).toBe("export const Hero = () => null;");
      }),
    ));

  it("read_component errors on an unknown path and lists what is available", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const result = yield* run(
          WorkspaceTools.readComponent(SCOPE, {
            editSessionId: EDIT_SESSION_ID,
            path: "components/ghost.tsx",
          }),
        );
        expect(result.isError).toBe(true);
        expect(result.output).toContain("components/hero.tsx");
      }),
    ));

  it("edit_paywall validates then applies, returning minted ids", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const result = yield* run(
          WorkspaceTools.editPaywall(SCOPE, {
            editSessionId: EDIT_SESSION_ID,
            edits: [{ op: "insert", parentId: "screen1", node: { type: "view" } }],
          }),
        );
        expect(result.isError).toBe(false);
        expect(result.output).toContain("version 9");
        expect(result.output).toContain("Minted ids");
        expect(result.output).toContain("abc1234567");
      }),
    ));

  it("edit_paywall auto-derives backgroundEnabled from a lone backgroundColor", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        // The applied edits are what the workspace commits — capture them and assert the
        // group flag was injected by the shared validator's write-side normalization.
        let applied: readonly unknown[] = [];
        const result = yield* run(
          WorkspaceTools.editPaywall(SCOPE, {
            editSessionId: EDIT_SESSION_ID,
            edits: [
              {
                op: "update",
                nodeId: "view1",
                set: { style: { backgroundColor: "rgba(1, 2, 3, 1)" } },
              },
            ],
          }),
          {
            workspace: fakeWorkspace({
              editConnectedDocument: (_projectId, _connection, edits) => {
                applied = edits;
                return Effect.succeed({ version: 9, commandCount: 1, mintedIds: {} });
              },
            }),
          },
        );
        expect(result.isError).toBe(false);
        const set = Schema.decodeUnknownSync(
          Schema.Struct({
            set: Schema.Struct({ style: Schema.Record(Schema.String, Schema.Unknown) }),
          }),
        )(applied[0]).set;
        expect(set.style.backgroundEnabled).toBe(true);
        expect(set.style.backgroundColor).toBe("rgba(1, 2, 3, 1)");
      }),
    ));

  it("edit_paywall returns structured validation errors and never applies", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const editDocument = notImplemented("editDocument must not run on a validation failure");
        const result = yield* run(
          WorkspaceTools.editPaywall(SCOPE, {
            editSessionId: EDIT_SESSION_ID,
            // view cannot be a child of text → illegalChild
            edits: [{ op: "insert", parentId: "text1", node: { type: "view" } }],
          }),
          { workspace: fakeWorkspace({ editConnectedDocument: editDocument }) },
        );
        expect(result.isError).toBe(true);
        expect(result.output).toContain("edit_paywall rejected");
        expect(result.output).toContain("text");
      }),
    ));

  it("edit_paywall folds a conflict into a clean message (no Cause/_tag leak)", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const result = yield* run(
          WorkspaceTools.editPaywall(SCOPE, {
            editSessionId: EDIT_SESSION_ID,
            edits: [{ op: "update", nodeId: "text1", set: { text: "Bye" } }],
          }),
          {
            workspace: fakeWorkspace({
              editConnectedDocument: () =>
                Effect.fail(new WorkspaceWriteConflictError({ message: "race lost" })),
            }),
          },
        );
        expect(result.isError).toBe(true);
        expect(result.output).toContain("edit_paywall rejected: race lost");
        expect(result.output).not.toContain("Cause(");
        expect(result.output).not.toContain("_tag");
      }),
    ));

  it("duplicate_subtree clones a visual subtree through an atomic edit", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        let applied: readonly unknown[] = [];
        const result = yield* run(
          WorkspaceTools.duplicateSubtree(SCOPE, {
            editSessionId: EDIT_SESSION_ID,
            nodeId: "view1",
            parentId: "screen1",
            nextName: "Copied offer",
          }),
          {
            workspace: fakeWorkspace({
              editConnectedDocument: (_projectId, _connection, edits) => {
                applied = edits;
                return Effect.succeed({ version: 10, commandCount: 1, mintedIds: {} });
              },
            }),
          },
        );
        expect(result.isError).toBe(false);
        expect(applied).toHaveLength(1);
        expect(applied[0]).toMatchObject({
          op: "insert",
          parentId: "screen1",
          node: { type: "view", name: "Copied offer", children: [{ type: "text", text: "Hi" }] },
        });
      }),
    ));

  it("get_paywall_preview returns image content and records its exact document version", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const recorded: unknown[] = [];
        const rendered: unknown[] = [];
        const catalogRoot = structuredClone(documentRoot);
        const screen = catalogRoot.children[0]!;
        screen.children.push({
          id: "component1",
          type: "component",
          parentId: "screen1",
          pos: "a1",
          data: {
            componentSource: "catalog",
            contentHash: "hash-1",
            previewState: "compact",
          },
          children: [],
        });
        const artifact = (state: string) => ({
          body: new TextEncoder().encode(encodeJson({ state, treeVersion: 2 })),
          contentType: "application/json",
        });
        const result = yield* run(
          WorkspaceTools.getPaywallPreview(SCOPE, {
            editSessionId: EDIT_SESSION_ID,
            width: 375,
            height: 812,
            scale: 1,
          }),
          {
            workspace: fakeWorkspace({
              readConnectedDocumentTree: () =>
                Effect.succeed({
                  tree: { encoded: true },
                  root: catalogRoot,
                  version: 8,
                }),
            }),
            editSessions: fakeEditSessions({
              recordPreview: (input) => Effect.sync(() => void recorded.push(input)),
            }),
            compiler: fakeCompiler({
              compileAndExtract: () =>
                Effect.succeed({
                  status: "ready",
                  manifest: {},
                  previewTrees: {
                    default: {
                      treeVersion: 1,
                      state: "default",
                      root: { type: "text", text: "Hero", style: {} },
                    },
                  },
                }),
            }),
            artifactStore: fakeArtifactStore({
              getObject: (key) => {
                if (key === componentServingPreviewKey("hash-1", "default")) {
                  return Effect.succeed(artifact("default"));
                }
                if (key === componentServingPreviewKey("hash-1", "compact")) {
                  return Effect.succeed(artifact("compact"));
                }
                return Effect.succeed(null);
              },
            }),
            renderer: {
              render: (input) =>
                Effect.sync(() => {
                  rendered.push(input);
                  return new Uint8Array([1, 2, 3]);
                }),
            },
          },
        );
        expect(result.isError, result.output).toBe(false);
        expect(result.content).toEqual([
          { type: "text", text: expect.stringContaining('"documentVersion":8') },
          { type: "image", data: "AQID", mimeType: "image/png" },
        ]);
        expect(recorded[0]).toMatchObject({ documentVersion: 8 });
        expect(rendered[0]).toMatchObject({
          componentTrees: {
            "hash-1": {
              default: { state: "default", treeVersion: 2 },
              compact: { state: "compact", treeVersion: 2 },
            },
          },
          localComponentTrees: {
            "components/hero.tsx": {
              default: {
                treeVersion: 1,
                state: "default",
                root: { type: "text", text: "Hero", style: {} },
              },
            },
          },
        });
      }),
    ));

  it("finish_paywall_edit binds the verdict to the current document version and signature", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const finished: unknown[] = [];
        const result = yield* run(
          WorkspaceTools.finishPaywallEdit(SCOPE, {
            editSessionId: EDIT_SESSION_ID,
            reviewedDocumentSignature: "doc-reviewed",
            verdict: "Clear hierarchy and no clipping.",
            unresolvedIssues: [],
          }),
          {
            editSessions: fakeEditSessions({
              finish: (input) =>
                Effect.sync(() => {
                  finished.push(input);
                  return { editSessionId: EDIT_SESSION_ID, status: "finished" };
                }),
            }),
          },
        );
        expect(result.isError, result.output).toBe(false);
        expect(finished[0]).toMatchObject({
          currentDocumentVersion: 8,
          reviewedDocumentSignature: "doc-reviewed",
          verdict: "Clear hierarchy and no clipping.",
        });
        const decoded = Schema.decodeUnknownSync(
          Schema.Struct({ currentDocumentSignature: Schema.String }),
        )(finished[0]);
        expect(decoded.currentDocumentSignature).toMatch(/^doc-/);
      }),
    ));

  it("finish_paywall_edit rejects unresolved visual issues without closing the edit session", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const finish = notImplemented("must not finish with unresolved visual issues");
        const result = yield* run(
          WorkspaceTools.finishPaywallEdit(SCOPE, {
            editSessionId: EDIT_SESSION_ID,
            reviewedDocumentSignature: "doc-reviewed",
            verdict: "Needs another pass.",
            unresolvedIssues: ["CTA is clipped"],
          }),
          { editSessions: fakeEditSessions({ finish }) },
        );
        expect(result.isError).toBe(true);
        expect(result.output).toContain("CTA is clipped");
      }),
    ));

  it("revert_paywall_edit restores the entire captured baseline", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const result = yield* run(
          WorkspaceTools.revertPaywallEdit(SCOPE, { editSessionId: EDIT_SESSION_ID }),
        );
        expect(result.isError, result.output).toBe(false);
        expect(result.output).toContain("Reverted edit session");
        expect(result.output).toContain("2 commands");
      }),
    ));

  it("write_component rejects a broken component with diagnostics (commits nothing)", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const writeComponentSource = notImplemented("must not commit on a compile error");
        const result = yield* run(
          WorkspaceTools.writeComponent(SCOPE, {
            editSessionId: EDIT_SESSION_ID,
            path: "components/broken.tsx",
            source: "export default (=> {",
          }),
          {
            workspace: fakeWorkspace({ writeConnectedComponentSource: writeComponentSource }),
            compiler: fakeCompiler({
              compileAndExtract: () =>
                Effect.succeed({
                  status: "error",
                  phase: "compile",
                  diagnostics: [{ message: "Unexpected token", line: 1, column: 17 }],
                }),
            }),
          },
        );
        expect(result.isError).toBe(true);
        expect(result.output).toContain("Unexpected token");
      }),
    ));

  it("write_component commits a clean component and records its manifest", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const recorded: unknown[] = [];
        const result = yield* run(
          WorkspaceTools.writeComponent(SCOPE, {
            editSessionId: EDIT_SESSION_ID,
            path: "components/card.tsx",
            source: "export default () => null;",
          }),
          {
            manifestCache: fakeManifestCache({
              record: (input) =>
                Effect.sync(() => {
                  recorded.push(input);
                  return undefined;
                }),
            }),
            compiler: fakeCompiler({
              compileAndExtract: () =>
                Effect.succeed({
                  status: "ready",
                  manifest: {
                    manifestVersion: 2,
                    props: {},
                    actions: {},
                    slot: false,
                    previewStates: ["default"],
                    hostData: [],
                  },
                  previewTrees: {},
                }),
            }),
          },
        );
        expect(result.isError).toBe(false);
        expect(result.output).toContain("manifest recorded");
        expect(recorded).toHaveLength(1);
      }),
    ));

  it("write_component rejects when headless compilation is unavailable", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const result = yield* run(
          WorkspaceTools.writeComponent(SCOPE, {
            editSessionId: EDIT_SESSION_ID,
            path: "components/card.tsx",
            source: "export default () => null;",
          }),
          // default compiler is `unavailable`
        );
        expect(result.isError).toBe(true);
        expect(result.output).toContain("headless component compilation is unavailable");
      }),
    ));

  it("write_component rejects an invalid file name before compiling", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const compileAndExtract = notImplemented("must not compile an invalid path");
        const result = yield* run(
          WorkspaceTools.writeComponent(SCOPE, {
            editSessionId: EDIT_SESSION_ID,
            path: "components/../evil.tsx",
            source: "export default () => null;",
          }),
          { compiler: fakeCompiler({ compileAndExtract }) },
        );
        expect(result.isError).toBe(true);
        expect(result.output).toContain("write_component rejected");
      }),
    ));

  it("rename_component moves a component and reports the version", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const result = yield* run(
          WorkspaceTools.renameComponent(SCOPE, {
            editSessionId: EDIT_SESSION_ID,
            fromPath: "components/hero.tsx",
            toPath: "components/banner.tsx",
          }),
        );
        expect(result.isError).toBe(false);
        expect(result.output).toContain("components/hero.tsx → components/banner.tsx");
      }),
    ));

  it("delete_component removes a component and warns about placeholders", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const result = yield* run(
          WorkspaceTools.deleteComponent(SCOPE, {
            editSessionId: EDIT_SESSION_ID,
            path: "components/hero.tsx",
          }),
        );
        expect(result.isError).toBe(false);
        expect(result.output).toContain("placeholders");
      }),
    ));

  it("a service failure folds into a readable message (no Cause leak)", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const result = yield* run(
          WorkspaceTools.getPaywall(SCOPE, { editSessionId: "missing_session" }),
          {
            workspace: fakeWorkspace({
              readConnectedDocumentTree: () =>
                Effect.fail(new PaywallNotFoundError({ message: 'No paywall "missing"' })),
            }),
          },
        );
        expect(result.isError).toBe(true);
        expect(result.output).toContain("get_paywall failed");
        expect(result.output).toContain('No paywall "missing"');
        expect(result.output).not.toContain("Cause(");
      }),
    ));
});
