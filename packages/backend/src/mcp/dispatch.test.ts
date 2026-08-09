/**
 * Tests the MCP tool dispatch path end-to-end through the stateful document-
 * editing core against a mocked workspace context. Proves: a valid
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
  PaywallEditSessionService,
  PaywallWorkspaceService,
  SnapshotImageRenderer,
  WorkspaceWriteConflictError,
} from "@voidhash/core/services";
import { AuthSession } from "@voidhash/core/domain/auth/Auth";
import { constant } from "@voidhash/lib/lang";
import { Context, Effect } from "effect";
import { describe, expect, it } from "vite-plus/test";

import { findMcpTool } from "./tool-manifest.ts";

/**
 * Builds a service test double from the subset of methods a test exercises.
 * The absent methods are deliberate: reaching one is a test bug. The single
 * unchecked widening (`Partial<T>` → `T`) lives in this overload rather than at
 * every fake.
 */
function serviceStub<T>(methods: Partial<T>): T;
function serviceStub<T>(methods: Partial<T>) {
  return methods;
}

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
  serviceStub<PaywallWorkspaceService["Service"]>({
    listPaywalls: () =>
      Effect.succeed([
        { slug: "trial", paywallId: "pw_1" },
        { slug: "onboarding", paywallId: "pw_2" },
      ]),
    readDocument: (_p: string, slug: string) =>
      Effect.succeed({
        slug,
        name: "Trial",
        paywallId: "pw_1",
        tree: {},
        root: documentRoot,
        version: 8,
      }),
    readConnectedDocumentTree: () => Effect.succeed({ tree: {}, root: documentRoot, version: 8 }),
    editDocument: () => Effect.succeed({ version: 9, commandCount: 2, mintedIds: {} }),
    editConnectedDocument: () => Effect.succeed({ version: 9, commandCount: 2, mintedIds: {} }),
    writeComponentSource: () => Effect.succeed({ version: 9, commandCount: 1, diagnostics: [] }),
    writeConnectedComponentSource: () =>
      Effect.succeed({ version: 9, commandCount: 1, diagnostics: [] }),
    moveComponentFile: () => Effect.succeed({ version: 9, commandCount: 1, diagnostics: [] }),
    moveConnectedComponentFile: () =>
      Effect.succeed({ version: 9, commandCount: 1, diagnostics: [] }),
    deleteComponentFile: () => Effect.succeed({ version: 9, commandCount: 1, diagnostics: [] }),
    deleteConnectedComponentFile: () =>
      Effect.succeed({ version: 9, commandCount: 1, diagnostics: [] }),
    ...over,
  });

const fakeDeploy = (over: Partial<PaywallDeployService["Service"]> = {}) =>
  serviceStub<PaywallDeployService["Service"]>({
    listComponents: () => Effect.succeed([]),
    ...over,
  });

const fakeManifestCache = (over: Partial<ComponentManifestCacheService["Service"]> = {}) =>
  serviceStub<ComponentManifestCacheService["Service"]>({
    getMany: () => Effect.succeed(new Map()),
    record: () => Effect.succeed(undefined),
    ...over,
  });

const fakeCompiler = (over: Partial<ComponentCompiler["Service"]> = {}) =>
  serviceStub<ComponentCompiler["Service"]>({
    compileCheck: () => Effect.succeed(constant({ status: "unavailable" })),
    compileAndExtract: () => Effect.succeed(constant({ status: "unavailable" })),
    ...over,
  });

const fakeEditSessions = (over: Partial<PaywallEditSessionService["Service"]> = {}) =>
  serviceStub<PaywallEditSessionService["Service"]>({
    recordMutation: () => Effect.void,
    connectActive: () =>
      Effect.succeed({
        editSessionId: "pw_edit_1",
        projectId: "proj_1",
        paywallId: "pw_1",
        paywallSlug: "trial",
        baselineVersion: 1,
      }),
    ...over,
  });

interface Fakes {
  readonly workspace?: PaywallWorkspaceService["Service"];
  readonly deploy?: PaywallDeployService["Service"];
  readonly manifestCache?: ComponentManifestCacheService["Service"];
  readonly compiler?: ComponentCompiler["Service"];
  readonly editSessions?: PaywallEditSessionService["Service"];
}

const contextWith = (fakes: Fakes) =>
  Context.empty().pipe(
    Context.add(PaywallWorkspaceService, fakes.workspace ?? fakeWorkspace()),
    Context.add(PaywallDeployService, fakes.deploy ?? fakeDeploy()),
    Context.add(ComponentManifestCacheService, fakes.manifestCache ?? fakeManifestCache()),
    Context.add(ComponentCompiler, fakes.compiler ?? fakeCompiler()),
    Context.add(PaywallEditSessionService, fakes.editSessions ?? fakeEditSessions()),
    Context.add(
      PaywallArtifactStore,
      serviceStub<PaywallArtifactStore["Service"]>({
        getObject: () => Effect.succeed(null),
      }),
    ),
    Context.add(
      SnapshotImageRenderer,
      serviceStub<SnapshotImageRenderer["Service"]>({
        render: () => Effect.succeed(new Uint8Array([1])),
      }),
    ),
    Context.add(AuthSession, serviceStub<AuthSession["Service"]>({})),
  );

const dispatchWith = (fakes: Fakes, name: string, args: unknown) =>
  Effect.gen(function* () {
    const tool = findMcpTool(name);
    if (tool === undefined) {
      return yield* Effect.die(new Error(`tool ${name} not found`));
    }
    return yield* tool
      .dispatch({ projectId: "proj_1" }, args)
      .pipe(Effect.provide(contextWith(fakes)));
  });

const dispatch = (name: string, args: unknown) => dispatchWith({}, name, args);

describe("MCP tool dispatch", () => {
  it("list_paywalls lists the project directories (no input)", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const result = yield* dispatch("list_paywalls", {});
        expect(result.isError).toBe(false);
        expect(result.output).toContain("pw_1: slug trial (/paywalls/trial)");
        expect(result.output).toContain("pw_2: slug onboarding (/paywalls/onboarding)");
      }),
    ));

  it("get_paywall returns the cleaned document JSON with node ids", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const result = yield* dispatch("get_paywall", { editSessionId: "pw_edit_1" });
        expect(result.isError).toBe(false);
        expect(result.output).toContain('"id": "root1"');
        expect(result.output).toContain('"type": "screen"');
      }),
    ));

  it("edit_paywall validates then applies, reporting the new version", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const result = yield* dispatch("edit_paywall", {
          editSessionId: "pw_edit_1",
          edits: [{ op: "insert", parentId: "screen1", node: { type: "view" } }],
        });
        expect(result.isError).toBe(false);
        expect(result.output).toContain("version 9");
      }),
    ));

  it("edit_paywall returns structured validation errors verbatim (no apply)", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const editConnectedDocument = () =>
          Effect.die(new Error("editConnectedDocument must not be called on a validation failure"));
        const result = yield* dispatchWith(
          { workspace: fakeWorkspace({ editConnectedDocument }) },
          "edit_paywall",
          // Unknown parent id → validation rejects before any submit.
          {
            editSessionId: "pw_edit_1",
            edits: [{ op: "insert", parentId: "ghost", node: { type: "view" } }],
          },
        );
        expect(result.isError).toBe(true);
        expect(result.output).toContain("edit_paywall rejected");
        expect(result.output).toContain("ghost");
      }),
    ));

  it("write_component rejects broken source with diagnostics (commits nothing)", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const writeConnectedComponentSource = () =>
          Effect.die(
            new Error("writeConnectedComponentSource must not be called on a compile error"),
          );
        const result = yield* dispatchWith(
          {
            workspace: fakeWorkspace({ writeConnectedComponentSource }),
            compiler: fakeCompiler({
              compileAndExtract: () =>
                Effect.succeed(
                  constant({
                    status: "error",
                    phase: "compile",
                    diagnostics: [{ message: "Unexpected token", line: 3 }],
                  }),
                ),
            }),
          },
          "write_component",
          {
            editSessionId: "pw_edit_1",
            path: "components/hero.tsx",
            source: "export default (=> {",
          },
        );
        expect(result.isError).toBe(true);
        expect(result.output).toContain("write_component rejected");
        expect(result.output).toContain("Unexpected token");
      }),
    ));

  it("write_component commits a clean component and records its manifest", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const recorded: unknown[] = [];
        const manifest = constant({
          manifestVersion: 2,
          props: {},
          actions: {},
          slot: false,
          previewStates: ["default"],
          hostData: [],
        });
        const result = yield* dispatchWith(
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
                Effect.succeed(constant({ status: "ready", manifest, previewTrees: {} })),
            }),
          },
          "write_component",
          {
            editSessionId: "pw_edit_1",
            path: "components/hero.tsx",
            source: "export default () => null;",
          },
        );
        expect(result.isError).toBe(false);
        expect(result.output).toContain("version 9");
        expect(result.output).toContain("manifest recorded");
        expect(recorded).toHaveLength(1);
      }),
    ));

  it("folds invalid arguments into an isError result (never throws)", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const result = yield* dispatch("get_paywall", {});
        expect(result.isError).toBe(true);
        expect(result.output).toContain("get_paywall: invalid arguments");
      }),
    ));

  it("folds an edit rejection into an isError result with a CLEAN message (no Cause/_tag leak)", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const result = yield* dispatchWith(
          {
            workspace: fakeWorkspace({
              editConnectedDocument: () =>
                Effect.fail(
                  new WorkspaceWriteConflictError({ message: "lost the concurrency race" }),
                ),
            }),
          },
          "edit_paywall",
          {
            editSessionId: "pw_edit_1",
            edits: [{ op: "insert", parentId: "screen1", node: { type: "view" } }],
          },
        );
        expect(result.isError).toBe(true);
        expect(result.output).toContain("edit_paywall rejected: lost the concurrency race");
        expect(result.output).not.toContain("Cause(");
        expect(result.output).not.toContain("_tag");
      }),
    ));
});
