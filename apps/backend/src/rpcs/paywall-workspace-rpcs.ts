import {
  ComponentManifestCacheService,
  PaywallWorkspaceService,
} from "@voidhash/core/services";
import {
  serializeDocument,
  type SnapshotDocumentNode,
} from "@voidhash/ai-shared";
import {
  PaywallWorkspaceRpcsDef,
  RpcActionForbiddenError,
  RpcComponentManifestInvalidError,
  RpcPaywallNotFoundError,
  RpcPaywallWorkspaceError,
} from "@voidhash/rpc";
import { Effect } from "effect";

/**
 * Read-only paywall workspace RPC handlers plus the content-addressed manifest
 * upload. List a project's paywall directories, read a paywall's live document as
 * cleaned JSON (the AI `read_paywall` tool), and accept the browser's manifest
 * uploads. Component edits go through the document-first AI/MCP tools; there is
 * no whole-fork apply. Service errors are mapped to the workspace RPC error
 * union; the underlying mimic/DB details stay server-side.
 */
export const PaywallWorkspaceRpcsLive = PaywallWorkspaceRpcsDef.toLayer(
  Effect.gen(function* () {
    const workspace = yield* PaywallWorkspaceService;
    const manifestCache = yield* ComponentManifestCacheService;

    return {
      ListWorkspacePaywalls: ({ projectId }) =>
        workspace.listPaywalls(projectId).pipe(
          Effect.catchTags({
            ActionForbiddenError: (error) =>
              Effect.fail(new RpcActionForbiddenError({ message: error.message })),
            PaywallServiceError: (error) =>
              Effect.fail(new RpcPaywallWorkspaceError({ message: error.cause })),
          }),
        ),
      /**
       * Read another paywall's LIVE document as cleaned JSON for the AI
       * `read_paywall` tool. `readDocument` resolves the slug within `projectId`
       * (the slug MUST belong to the project) and reads the decoded document root,
       * which {@link serializeDocument} cleans into the schema-loose tree the model
       * reads (nested `{ id, type, name?, ...data, children }`, defaults stripped).
       * Read-only.
       */
      ReadPaywallDocument: ({ projectId, slug }) =>
        workspace.readDocument(projectId, slug).pipe(
          Effect.map((resolved) => {
            // The decoded renderer root is the single `SnapshotDocumentNode` the
            // serializer cleans; `serializeDocument` unwraps CRDT envelopes and
            // strips schema-default fields. A `null`/missing root (empty document)
            // serializes to `{}` so the wire shape stays a document object.
            const roots =
              resolved.root != null ? [resolved.root as SnapshotDocumentNode] : [];
            return {
              slug: resolved.slug,
              name: resolved.name,
              paywallId: resolved.paywallId,
              document: serializeDocument(roots) ?? {},
            };
          }),
          Effect.catchTags({
            ActionForbiddenError: (error) =>
              Effect.fail(new RpcActionForbiddenError({ message: error.message })),
            PaywallNotFoundError: (error) =>
              Effect.fail(new RpcPaywallNotFoundError({ message: error.message })),
            PaywallServiceError: (error) =>
              Effect.fail(new RpcPaywallWorkspaceError({ message: error.cause })),
            PaywallWorkspaceServiceError: (error) =>
              Effect.fail(new RpcPaywallWorkspaceError({ message: error.message })),
          }),
        ),
      RecordComponentManifest: (input) =>
        manifestCache.record(input).pipe(
          Effect.catchTags({
            ComponentManifestInvalidError: (error) =>
              Effect.fail(new RpcComponentManifestInvalidError({ message: error.message })),
            ComponentManifestCacheError: (error) =>
              Effect.fail(new RpcPaywallWorkspaceError({ message: error.message })),
          }),
        ),
    };
  }),
);
