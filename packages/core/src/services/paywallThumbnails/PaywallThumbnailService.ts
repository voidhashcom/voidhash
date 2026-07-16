import { Cause, Context, Effect, Layer, Predicate, Schema } from "effect";

import { Db, and, eq, isNull, lt, or, paywalls, type Paywall } from "@voidhash/db";
import { hashSource } from "@voidhash/paywall-workspace";

import {
  derivePaywallThumbnailKey,
  isOwnedPaywallThumbnailUrl,
  paywallThumbnailKeyFromUrl,
} from "../../domain/paywallThumbnail.ts";
import { componentServingPreviewKey } from "../paywallDeploys/PaywallDeployManifest.ts";
import { PaywallArtifactStore } from "../paywallDeploys/PaywallArtifactStore.ts";
import { MimicHost } from "../paywalls/MimicHost.ts";
import { ComponentCompiler } from "../paywallWorkspace/ComponentCompiler.ts";
import { ComponentManifestCacheService } from "../paywallWorkspace/ComponentManifestCacheService.ts";
import { PublicFileStore } from "../storage/PublicFileStore.ts";
import { SnapshotImageRenderer } from "./SnapshotImageRenderer.ts";

/** Viewport the thumbnail is rendered at — the designer's phone-frame dimensions. */
const THUMBNAIL_WIDTH = 375;
const THUMBNAIL_HEIGHT = 812;
const THUMBNAIL_DEVICE_SCALE_FACTOR = 2;

/** Preview state rendered for a deployed component in a thumbnail (spec §8 fallback base). */
const THUMBNAIL_PREVIEW_STATE = "default";

/**
 * Catch-all error raised by the paywall-thumbnail render entry points for real
 * failures (snapshot fetch, render/screenshot, store, or DB write). A missing
 * paywall row (non-paywall documents on the generic idle queue) and a stale
 * `seq` are NOT errors — they succeed as no-ops.
 */
export class PaywallThumbnailServiceError extends Schema.TaggedErrorClass<PaywallThumbnailServiceError>(
  "PaywallThumbnailServiceError",
)("PaywallThumbnailServiceError", { message: Schema.String }) {}

/** A snapshot tree node in the renderer `SnapshotNode` shape (structural subset). */
interface SnapshotNodeLike {
  readonly type: string;
  readonly data?: { readonly contentHash?: unknown } | undefined;
  readonly children?: readonly unknown[] | undefined;
}

const isSnapshotNodeLike = (value: unknown): value is SnapshotNodeLike =>
  Predicate.hasProperty(value, "type") && typeof value.type === "string";

/**
 * Collects the distinct non-empty `contentHash`es of the snapshot's deployed
 * `component` nodes (depth-first). Local code components pin a sentinel
 * `contentHash: ""` and are handled separately by the component compiler.
 */
export const collectDeployedComponentContentHashes = (snapshot: unknown): ReadonlySet<string> => {
  const hashes = new Set<string>();
  const visit = (value: unknown): void => {
    if (!isSnapshotNodeLike(value)) {
      return;
    }
    if (value.type === "component") {
      const contentHash = value.data?.contentHash;
      if (typeof contentHash === "string" && contentHash !== "") {
        hashes.add(contentHash);
      }
    }
    for (const child of value.children ?? []) {
      visit(child);
    }
  };
  visit(snapshot);
  return hashes;
};

/** Collects local component definitions embedded in a paywall document library. */
export const collectLocalComponentSources = (
  snapshot: unknown,
): ReadonlyArray<{ readonly path: string; readonly source: string }> => {
  const components: Array<{ readonly path: string; readonly source: string }> = [];
  const visit = (value: unknown): void => {
    if (!isSnapshotNodeLike(value)) {
      return;
    }
    if (value.type === "codeComponent") {
      const data = value.data as { readonly path?: unknown; readonly source?: unknown } | undefined;
      if (typeof data?.path === "string" && typeof data.source === "string") {
        components.push({ path: data.path, source: data.source });
      }
    }
    for (const child of value.children ?? []) {
      visit(child);
    }
  };
  visit(snapshot);
  return components;
};

/**
 * `PaywallThumbnailService` owns the render vertical of the paywall-thumbnail
 * feature: it renders a mimic document snapshot to a PNG and publishes it,
 * gated by a monotonic `seq` guard so a late render never clobbers a newer one.
 * Queue consumers call `handleDocumentIdle`; list-page backfills call
 * `renderCurrent` so paywalls created before idle notifications were available
 * (or whose best-effort queue message was exhausted) can recover.
 *
 * The queue is generic — non-paywall documents may arrive — so a missing
 * paywall row is a silent no-op. `Db`, `MimicHost`, `PaywallArtifactStore`,
 * `PublicFileStore`, and {@link SnapshotImageRenderer} are provided by the
 * application root; all infra deps are abstract ports, so the service stays
 * infra-pure. Local code components reuse renderer-ready trees from
 * {@link ComponentManifestCacheService}, falling back to
 * {@link ComponentCompiler} and recording the result on a cache miss. The
 * `SnapshotImageRenderer` adapter itself depends on the {@link HtmlScreenshot}
 * port, which the application root wires alongside it.
 */
export class PaywallThumbnailService extends Context.Service<PaywallThumbnailService>()(
  "PaywallThumbnailService",
  {
    make: Effect.gen(function* () {
      const db = yield* Db;
      const mimicHost = yield* MimicHost;
      const artifactStore = yield* PaywallArtifactStore;
      const componentCompiler = yield* ComponentCompiler;
      const componentManifestCache = yield* ComponentManifestCacheService;
      const publicFileStore = yield* PublicFileStore;
      const renderer = yield* SnapshotImageRenderer;

      /**
       * Fetches the "default"-state preview tree for each deployed component
       * contentHash from the public serving layout
       * (`c/<contentHash>/previews/default.json`). A missing object (`null`) or an
       * undecodable tree degrades to absent (the renderer shows a placeholder). A
       * real store failure (`PaywallArtifactStoreError` — e.g. an R2 outage) is NOT
       * swallowed: it propagates so the render fails rather than pinning a
       * placeholder-filled thumbnail + advancing `thumbnail_seq`.
       */
      const fetchComponentTrees = (contentHashes: ReadonlySet<string>) =>
        Effect.gen(function* () {
          const trees: Record<string, Record<string, unknown>> = {};
          for (const contentHash of contentHashes) {
            const key = componentServingPreviewKey(contentHash, THUMBNAIL_PREVIEW_STATE);
            const object = yield* artifactStore.getObject(key);
            if (object === null) {
              continue;
            }
            const tree = yield* Effect.try({
              try: (): unknown => JSON.parse(new TextDecoder().decode(object.body)),
              catch: () => null,
            }).pipe(Effect.orElseSucceed(() => null));
            if (tree !== null) {
              trees[contentHash] = { [THUMBNAIL_PREVIEW_STATE]: tree };
            }
          }
          return trees;
        });

      const compileLocalComponentTrees = (snapshot: unknown) =>
        Effect.gen(function* () {
          const trees: Record<string, Record<string, unknown>> = {};
          const components = collectLocalComponentSources(snapshot);
          const hashes = components.map((component) => hashSource(component.source));
          const cached = yield* componentManifestCache.getMany(hashes);

          for (const component of components) {
            const sourceHash = hashSource(component.source);
            const cachedTrees = cached.get(sourceHash)?.previewTrees;
            if (cachedTrees !== null && cachedTrees !== undefined) {
              trees[component.path] = { ...cachedTrees };
              continue;
            }

            const result = yield* componentCompiler.compileAndExtract(component.source);
            if (result.status === "unavailable") {
              return yield* Effect.fail(
                new PaywallThumbnailServiceError({
                  message: `Local component compiler unavailable for ${component.path}`,
                }),
              );
            }
            if (result.status === "error") {
              return yield* Effect.fail(
                new PaywallThumbnailServiceError({
                  message: `Local component ${component.path} failed to compile: ${result.diagnostics
                    .map((diagnostic) => diagnostic.message)
                    .join("; ")}`,
                }),
              );
            }
            trees[component.path] = { ...result.previewTrees };
            yield* componentManifestCache.record({
              sourceHash,
              status: "ready",
              manifest: result.manifest,
              previewTrees: result.previewTrees,
            });
          }
          return trees;
        });

      const renderPaywall = Effect.fn("renderPaywallThumbnail")(function* (input: {
        readonly paywall: Paywall;
        readonly seq: number;
        readonly snapshot: unknown;
      }) {
        const { paywall, seq, snapshot } = input;

        // Idempotency guard: a render at or beyond this seq already landed.
        if (
          paywall.thumbnailSeq !== null &&
          (paywall.thumbnailSeq > seq ||
            (paywall.thumbnailSeq === seq && paywall.thumbnailUrl !== null))
        ) {
          yield* Effect.logDebug(
            `Paywall ${paywall.id} thumbnail already at seq ${paywall.thumbnailSeq} >= ${seq}; skipping`,
          );
          return;
        }

        const contentHashes = collectDeployedComponentContentHashes(snapshot);
        const componentTrees = yield* fetchComponentTrees(contentHashes);
        const localComponentTrees = yield* compileLocalComponentTrees(snapshot);

        const png = yield* renderer.render({
          componentTrees,
          localComponentTrees,
          deviceScaleFactor: THUMBNAIL_DEVICE_SCALE_FACTOR,
          height: THUMBNAIL_HEIGHT,
          snapshot,
          width: THUMBNAIL_WIDTH,
        });

        const key = derivePaywallThumbnailKey(paywall.projectId, paywall.id, seq);
        yield* publicFileStore.putObject({ body: png, contentType: "image/png", key });
        const url = publicFileStore.publicUrl(key);

        // Race-guarded write: only advance if no newer render beat us to the
        // row. A concurrent render for a higher seq wins; we delete the object
        // we just wrote and stop.
        const updated = yield* db
          .update(paywalls)
          .set({ thumbnailSeq: seq, thumbnailUrl: url })
          .where(
            and(
              eq(paywalls.id, paywall.id),
              or(
                isNull(paywalls.thumbnailSeq),
                lt(paywalls.thumbnailSeq, seq),
                and(eq(paywalls.thumbnailSeq, seq), isNull(paywalls.thumbnailUrl)),
              ),
            ),
          )
          .returning({ id: paywalls.id });

        if (updated.length === 0) {
          yield* Effect.logDebug(
            `Paywall ${paywall.id} thumbnail seq ${seq} lost the write race; discarding`,
          );
          yield* publicFileStore
            .deleteObject(key)
            .pipe(
              Effect.catchCause((cause) =>
                Effect.logWarning(
                  `Failed to delete superseded thumbnail object ${key}: ${Cause.pretty(cause)}`,
                ),
              ),
            );
          return;
        }

        // Best-effort cleanup of the PREVIOUS thumbnail object, scoped to keys
        // we own for this project + paywall.
        if (
          isOwnedPaywallThumbnailUrl(
            paywall.thumbnailUrl,
            paywall.projectId,
            paywall.id,
            publicFileStore.publicBaseUrl,
          )
        ) {
          const previousKey = paywallThumbnailKeyFromUrl(
            paywall.thumbnailUrl!,
            paywall.projectId,
            paywall.id,
            publicFileStore.publicBaseUrl,
          );
          if (previousKey !== null && previousKey !== key) {
            yield* publicFileStore
              .deleteObject(previousKey)
              .pipe(
                Effect.catchCause((cause) =>
                  Effect.logWarning(
                    `Failed to delete previous thumbnail object ${previousKey}: ${Cause.pretty(cause)}`,
                  ),
                ),
              );
          }
        }

        yield* Effect.log(`Rendered thumbnail for paywall ${paywall.id} at seq ${seq}`);
      });

      const handleDocumentIdle = Effect.fn("handleDocumentIdle")(
        function* (input: { readonly documentId: string; readonly seq: number }) {
          yield* Effect.annotateCurrentSpan("voidhash.paywall.id", input.documentId);
          yield* Effect.annotateCurrentSpan("voidhash.paywall_thumbnail.seq", input.seq);

          const paywall = yield* db.query.paywalls.findFirst({ where: { id: input.documentId } });
          if (!paywall) {
            // Generic idle queue: non-paywall documents are expected — no-op.
            yield* Effect.logDebug(
              `Idle document ${input.documentId} is not a paywall; skipping thumbnail render`,
            );
            return;
          }
          yield* Effect.annotateCurrentSpan("voidhash.project.id", paywall.projectId);

          const snapshot = yield* mimicHost.getPaywallSnapshot(paywall.id);
          yield* renderPaywall({ paywall, seq: input.seq, snapshot });
        },
        (effect) =>
          effect.pipe(
            Effect.catchTags({
              EffectDrizzleQueryError: (error) =>
                Effect.fail(new PaywallThumbnailServiceError({ message: String(error.cause) })),
              ComponentCompilerError: (error) =>
                Effect.fail(new PaywallThumbnailServiceError({ message: error.message })),
              ComponentManifestCacheError: (error) =>
                Effect.fail(new PaywallThumbnailServiceError({ message: error.message })),
              ComponentManifestInvalidError: (error) =>
                Effect.fail(new PaywallThumbnailServiceError({ message: error.message })),
              MimicHostError: (error) =>
                Effect.fail(new PaywallThumbnailServiceError({ message: error.message })),
              PaywallArtifactStoreError: (error) =>
                Effect.fail(
                  new PaywallThumbnailServiceError({
                    message: `${error.message}: ${error.cause}`,
                  }),
                ),
              PublicFileStoreError: (error) =>
                Effect.fail(
                  new PaywallThumbnailServiceError({
                    message: `${error.message}: ${error.cause}`,
                  }),
                ),
              SnapshotImageRenderError: (error) =>
                Effect.fail(new PaywallThumbnailServiceError({ message: error.message })),
            }),
          ),
      );

      const renderCurrent = Effect.fn("renderCurrentPaywallThumbnail")(
        function* (paywallId: string) {
          yield* Effect.annotateCurrentSpan("voidhash.paywall.id", paywallId);
          const paywall = yield* db.query.paywalls.findFirst({ where: { id: paywallId } });
          if (!paywall) {
            return;
          }
          yield* Effect.annotateCurrentSpan("voidhash.project.id", paywall.projectId);

          yield* mimicHost.ensurePaywallDocument(paywall.id);
          const document = yield* mimicHost.getPaywallDocument(paywall.id);
          yield* Effect.annotateCurrentSpan("voidhash.paywall_thumbnail.seq", document.version);
          yield* renderPaywall({ paywall, seq: document.version, snapshot: document.root });
        },
        (effect) =>
          effect.pipe(
            Effect.catchTags({
              EffectDrizzleQueryError: (error) =>
                Effect.fail(new PaywallThumbnailServiceError({ message: String(error.cause) })),
              ComponentCompilerError: (error) =>
                Effect.fail(new PaywallThumbnailServiceError({ message: error.message })),
              ComponentManifestCacheError: (error) =>
                Effect.fail(new PaywallThumbnailServiceError({ message: error.message })),
              ComponentManifestInvalidError: (error) =>
                Effect.fail(new PaywallThumbnailServiceError({ message: error.message })),
              MimicHostError: (error) =>
                Effect.fail(new PaywallThumbnailServiceError({ message: error.message })),
              PaywallArtifactStoreError: (error) =>
                Effect.fail(
                  new PaywallThumbnailServiceError({
                    message: `${error.message}: ${error.cause}`,
                  }),
                ),
              PublicFileStoreError: (error) =>
                Effect.fail(
                  new PaywallThumbnailServiceError({
                    message: `${error.message}: ${error.cause}`,
                  }),
                ),
              SnapshotImageRenderError: (error) =>
                Effect.fail(new PaywallThumbnailServiceError({ message: error.message })),
            }),
          ),
      );

      return { handleDocumentIdle, renderCurrent } as const;
    }),
  },
) {
  static layer = Layer.effect(PaywallThumbnailService)(PaywallThumbnailService.make);
}
