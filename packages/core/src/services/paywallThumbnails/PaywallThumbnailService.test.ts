import { Effect, Layer } from "effect";

import { constant } from "@voidhash/lib/lang";

import { describe, expect, it } from "../../testing/effect-vitest.ts";

import { Db } from "@voidhash/db";
import { hashSource } from "@voidhash/paywall-workspace";

import { PaywallArtifactStore } from "../paywallDeploys/PaywallArtifactStore.ts";
import { MimicHost } from "../paywalls/MimicHost.ts";
import { ComponentCompiler } from "../paywallWorkspace/ComponentCompiler.ts";
import { ComponentManifestCacheService } from "../paywallWorkspace/ComponentManifestCacheService.ts";
import { PublicFileStore } from "../storage/PublicFileStore.ts";
import { SnapshotImageRenderer } from "./SnapshotImageRenderer.ts";

import {
  collectDeployedComponentContentHashes,
  collectLocalComponentSources,
  PaywallThumbnailService,
} from "./PaywallThumbnailService.ts";

/** Mirrors the `fakeService` helper used by the sibling paywall unit tests. */
const fakeService = (impl: object): any => impl;

describe("collectDeployedComponentContentHashes", () => {
  it("collects distinct non-empty contentHashes of deployed component nodes depth-first", () => {
    const snapshot = {
      type: "root",
      children: [
        {
          type: "screen",
          children: [
            { type: "component", data: { contentHash: "aaa" }, children: [] },
            {
              type: "view",
              children: [{ type: "component", data: { contentHash: "bbb" }, children: [] }],
            },
            // duplicate — deduped
            { type: "component", data: { contentHash: "aaa" }, children: [] },
          ],
        },
      ],
    };
    expect([...collectDeployedComponentContentHashes(snapshot)].sort()).toEqual(["aaa", "bbb"]);
  });

  it("skips local components (sentinel empty contentHash) and non-component nodes", () => {
    const snapshot = {
      type: "root",
      children: [
        // local code component — compiled from its embedded definition instead
        { type: "component", data: { contentHash: "", componentSource: "local" }, children: [] },
        { type: "text", data: { text: "hi" }, children: [] },
        { type: "component", data: {}, children: [] },
      ],
    };
    expect(collectDeployedComponentContentHashes(snapshot).size).toBe(0);
  });

  it("tolerates a malformed / undefined snapshot", () => {
    expect(collectDeployedComponentContentHashes(undefined).size).toBe(0);
    expect(collectDeployedComponentContentHashes({ type: "root" }).size).toBe(0);
    expect(collectDeployedComponentContentHashes(null).size).toBe(0);
  });
});

describe("collectLocalComponentSources", () => {
  it("collects code component paths and sources from the document library", () => {
    const snapshot = {
      type: "root",
      children: [
        {
          type: "library",
          children: [
            {
              type: "codeComponent",
              data: { path: "components/product-list.tsx", source: "export default productList" },
              children: [],
            },
            {
              type: "codeComponent",
              data: {
                path: "components/purchase-button.tsx",
                source: "export default purchaseButton",
              },
              children: [],
            },
          ],
        },
      ],
    };

    expect(collectLocalComponentSources(snapshot)).toEqual([
      { path: "components/product-list.tsx", source: "export default productList" },
      { path: "components/purchase-button.tsx", source: "export default purchaseButton" },
    ]);
  });

  it("ignores malformed definitions and tolerates a missing snapshot", () => {
    expect(
      collectLocalComponentSources({
        type: "root",
        children: [
          { type: "codeComponent", data: { path: "components/missing-source.tsx" } },
          { type: "codeComponent", data: { source: "missing path" } },
        ],
      }),
    ).toEqual([]);
    expect(collectLocalComponentSources(undefined)).toEqual([]);
  });
});

describe("PaywallThumbnailService local components", () => {
  it.effect("passes cached editor preview trees to the thumbnail renderer", () =>
    Effect.gen(function* () {
      const paywallId = "pw_local";
      const projectId = "proj_local";
      const componentPath = "components/product-list.tsx";
      const componentSource = "export default productList";
      const sourceHash = hashSource(componentSource);
      const previewTrees = {
        default: {
          root: { type: "text", style: {}, text: "Yearly" },
          state: "default",
          treeVersion: 1,
        },
      };
      const snapshot = {
        type: "root",
        children: [
          {
            type: "screen",
            children: [
              {
                type: "component",
                data: {
                  componentPath,
                  componentSource: "local",
                  contentHash: "",
                },
                children: [],
              },
            ],
          },
          {
            type: "library",
            children: [
              {
                type: "codeComponent",
                data: { path: componentPath, source: componentSource },
                children: [],
              },
            ],
          },
        ],
      };
      const paywall = {
        id: paywallId,
        projectId,
        thumbnailSeq: 11,
        thumbnailUrl: "https://files.test/files/paywall-thumbnails/proj_local/pw_local/11.png",
      };
      let rendererInput: unknown;
      let compileCalls = 0;
      let storedObject:
        | {
            readonly body: Uint8Array;
            readonly contentType: string | undefined;
            readonly key: string;
          }
        | undefined;
      let thumbnailUpdate: unknown;
      const storageOperations: string[] = [];

      const db = {
        query: {
          paywalls: {
            findFirst: () => Effect.succeed(paywall),
          },
        },
        transaction: (run: (tx: unknown) => unknown) =>
          run({
            select: () => ({
              from: () => ({
                where: () => ({
                  for: () => Effect.succeed([paywall]),
                }),
              }),
            }),
            update: () => ({
              set: (value: unknown) => {
                thumbnailUpdate = value;
                return { where: () => Effect.void };
              },
            }),
          }),
      };
      const dependencies = Layer.mergeAll(
        Layer.succeed(Db, fakeService(db)),
        Layer.succeed(
          MimicHost,
          fakeService({
            getPaywallSnapshot: () => Effect.succeed(snapshot),
          }),
        ),
        Layer.succeed(PaywallArtifactStore, {
          bucketName: "test",
          getObject: () => Effect.succeed(null),
          head: () => Effect.succeed(null),
          putObject: () => Effect.void,
        }),
        Layer.succeed(ComponentCompiler, {
          compileCheck: () => Effect.succeed({ status: constant("unavailable") }),
          compileAndExtract: () => {
            compileCalls += 1;
            return Effect.succeed({ status: constant("unavailable") });
          },
        }),
        Layer.succeed(ComponentManifestCacheService, {
          getMany: (hashes) =>
            Effect.sync(() => {
              expect(hashes).toEqual([sourceHash]);
              return new Map([
                [
                  sourceHash,
                  {
                    diagnostics: [],
                    manifest: null,
                    previewTrees,
                    sourceHash,
                    status: constant("ready"),
                  },
                ],
              ]);
            }),
          record: () => Effect.succeed(undefined),
        }),
        Layer.succeed(PublicFileStore, {
          publicBaseUrl: "https://files.test",
          publicUrl: (key) => `https://files.test/files/${key}`,
          putObject: (input) =>
            Effect.sync(() => {
              storedObject = input;
              storageOperations.push(`put:${input.key}`);
            }),
          getObject: () => Effect.succeed(null),
          deleteObject: (key) =>
            Effect.sync(() => {
              storageOperations.push(`delete:${key}`);
            }),
        }),
        Layer.succeed(SnapshotImageRenderer, {
          render: (input) =>
            Effect.sync(() => {
              rendererInput = input;
              return new Uint8Array([1, 2, 3]);
            }),
        }),
      );
      const layer = PaywallThumbnailService.layer.pipe(Layer.provide(dependencies));

      yield* Effect.gen(function* () {
        const service = yield* PaywallThumbnailService;
        yield* service.handleDocumentIdle({ documentId: paywallId, seq: 12 });
      }).pipe(Effect.provide(layer));

      expect(compileCalls).toBe(0);
      expect(rendererInput).toMatchObject({
        localComponentTrees: { [componentPath]: previewTrees },
        snapshot,
      });
      expect(storedObject).toMatchObject({
        contentType: "image/png",
        key: "paywall-thumbnails/proj_local/pw_local/thumbnail.png",
      });
      expect(thumbnailUpdate).toEqual({
        thumbnailSeq: 12,
        thumbnailUrl:
          "https://files.test/files/paywall-thumbnails/proj_local/pw_local/thumbnail.png?v=12",
      });
      expect(storageOperations).toEqual([
        "delete:paywall-thumbnails/proj_local/pw_local/11.png",
        "put:paywall-thumbnails/proj_local/pw_local/thumbnail.png",
      ]);
    }),
  );
});

describe("PaywallThumbnailService forced renders", () => {
  it.effect("rerenders the current document version with a fresh cache-busting URL", () =>
    Effect.gen(function* () {
      const paywall = {
        id: "pw_force",
        projectId: "proj_force",
        thumbnailSeq: 7,
        thumbnailUrl:
          "https://files.test/files/paywall-thumbnails/proj_force/pw_force/thumbnail.png?v=7",
      };
      const snapshot = { children: [], type: "root" };
      let renderCalls = 0;
      let thumbnailUpdate: { thumbnailSeq: number; thumbnailUrl: string } | undefined;

      const db = {
        query: {
          paywalls: {
            findFirst: () => Effect.succeed(paywall),
          },
        },
        transaction: (run: (tx: unknown) => unknown) =>
          run({
            select: () => ({
              from: () => ({
                where: () => ({
                  for: () => Effect.succeed([paywall]),
                }),
              }),
            }),
            update: () => ({
              set: (value: typeof thumbnailUpdate) => {
                thumbnailUpdate = value;
                return { where: () => Effect.void };
              },
            }),
          }),
      };
      const dependencies = Layer.mergeAll(
        Layer.succeed(Db, fakeService(db)),
        Layer.succeed(
          MimicHost,
          fakeService({
            ensurePaywallDocument: () => Effect.void,
            // Version-space is one ahead of the queue's seq-space: version 8 is the
            // same document state a queue render would have stored as seq 7.
            getPaywallDocument: () => Effect.succeed({ root: snapshot, version: 8 }),
          }),
        ),
        Layer.succeed(PaywallArtifactStore, {
          bucketName: "test",
          getObject: () => Effect.succeed(null),
          head: () => Effect.succeed(null),
          putObject: () => Effect.void,
        }),
        Layer.succeed(ComponentCompiler, {
          compileAndExtract: () => Effect.succeed({ status: constant("unavailable") }),
          compileCheck: () => Effect.succeed({ status: constant("unavailable") }),
        }),
        Layer.succeed(ComponentManifestCacheService, {
          getMany: () => Effect.succeed(new Map()),
          record: () => Effect.succeed(undefined),
        }),
        Layer.succeed(PublicFileStore, {
          deleteObject: () => Effect.void,
          getObject: () => Effect.succeed(null),
          publicBaseUrl: "https://files.test",
          publicUrl: (key) => `https://files.test/files/${key}`,
          putObject: () => Effect.void,
        }),
        Layer.succeed(SnapshotImageRenderer, {
          render: () =>
            Effect.sync(() => {
              renderCalls += 1;
              return new Uint8Array([1, 2, 3]);
            }),
        }),
      );
      const layer = PaywallThumbnailService.layer.pipe(Layer.provide(dependencies));

      const result = yield* Effect.gen(function* () {
        const service = yield* PaywallThumbnailService;
        const skipped = yield* service.renderCurrent(paywall.id);
        const forced = yield* service.forceRenderCurrent(paywall.id);
        return { forced, skipped };
      }).pipe(Effect.provide(layer));

      expect(result).toEqual({ forced: true, skipped: false });
      expect(renderCalls).toBe(1);
      expect(thumbnailUpdate).toMatchObject({ thumbnailSeq: 7 });
      expect(thumbnailUpdate?.thumbnailUrl).toMatch(
        /^https:\/\/files\.test\/files\/paywall-thumbnails\/proj_force\/pw_force\/thumbnail\.png\?v=7&r=[0-9a-f-]+$/,
      );
    }),
  );

  it.effect("bypasses a stored thumbnailSeq ahead of the current document (repairs poisoned rows)", () =>
    Effect.gen(function* () {
      // A row written with a version-space seq (the pre-fix force path) sits one
      // ahead of anything the queue will ever publish; force must still replace it.
      const paywall = {
        id: "pw_repair",
        projectId: "proj_repair",
        thumbnailSeq: 8,
        thumbnailUrl:
          "https://files.test/files/paywall-thumbnails/proj_repair/pw_repair/thumbnail.png?v=8",
      };
      const snapshot = { children: [], type: "root" };
      let thumbnailUpdate: { thumbnailSeq: number; thumbnailUrl: string } | undefined;

      const db = {
        query: {
          paywalls: {
            findFirst: () => Effect.succeed(paywall),
          },
        },
        transaction: (run: (tx: unknown) => unknown) =>
          run({
            select: () => ({
              from: () => ({
                where: () => ({
                  for: () => Effect.succeed([paywall]),
                }),
              }),
            }),
            update: () => ({
              set: (value: typeof thumbnailUpdate) => {
                thumbnailUpdate = value;
                return { where: () => Effect.void };
              },
            }),
          }),
      };
      const dependencies = Layer.mergeAll(
        Layer.succeed(Db, fakeService(db)),
        Layer.succeed(
          MimicHost,
          fakeService({
            ensurePaywallDocument: () => Effect.void,
            getPaywallDocument: () => Effect.succeed({ root: snapshot, version: 8 }),
          }),
        ),
        Layer.succeed(PaywallArtifactStore, {
          bucketName: "test",
          getObject: () => Effect.succeed(null),
          head: () => Effect.succeed(null),
          putObject: () => Effect.void,
        }),
        Layer.succeed(ComponentCompiler, {
          compileAndExtract: () => Effect.succeed({ status: constant("unavailable") }),
          compileCheck: () => Effect.succeed({ status: constant("unavailable") }),
        }),
        Layer.succeed(ComponentManifestCacheService, {
          getMany: () => Effect.succeed(new Map()),
          record: () => Effect.succeed(undefined),
        }),
        Layer.succeed(PublicFileStore, {
          deleteObject: () => Effect.void,
          getObject: () => Effect.succeed(null),
          publicBaseUrl: "https://files.test",
          publicUrl: (key) => `https://files.test/files/${key}`,
          putObject: () => Effect.void,
        }),
        Layer.succeed(SnapshotImageRenderer, {
          render: () => Effect.succeed(new Uint8Array([1, 2, 3])),
        }),
      );
      const layer = PaywallThumbnailService.layer.pipe(Layer.provide(dependencies));

      const forced = yield* Effect.gen(function* () {
        const service = yield* PaywallThumbnailService;
        return yield* service.forceRenderCurrent(paywall.id);
      }).pipe(Effect.provide(layer));

      expect(forced).toBe(true);
      expect(thumbnailUpdate).toMatchObject({ thumbnailSeq: 7 });
    }),
  );
});
