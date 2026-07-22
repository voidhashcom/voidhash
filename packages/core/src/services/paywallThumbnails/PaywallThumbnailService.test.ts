import { Effect, Layer } from "effect";
import { describe, expect, it } from "vite-plus/test";

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
  it("passes cached editor preview trees to the thumbnail renderer", async () => {
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
      Layer.succeed(Db, db as never),
      Layer.succeed(MimicHost, {
        getPaywallSnapshot: () => Effect.succeed(snapshot),
      } as never),
      Layer.succeed(PaywallArtifactStore, {
        bucketName: "test",
        getObject: () => Effect.succeed(null),
        head: () => Effect.succeed(null),
        putObject: () => Effect.void,
      }),
      Layer.succeed(ComponentCompiler, {
        compileCheck: () => Effect.succeed({ status: "unavailable" as const }),
        compileAndExtract: () => {
          compileCalls += 1;
          return Effect.succeed({ status: "unavailable" as const });
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
                  status: "ready" as const,
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

    await Effect.runPromise(
      Effect.gen(function* () {
        const service = yield* PaywallThumbnailService;
        yield* service.handleDocumentIdle({ documentId: paywallId, seq: 12 });
      }).pipe(Effect.provide(layer)),
    );

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
  });
});
