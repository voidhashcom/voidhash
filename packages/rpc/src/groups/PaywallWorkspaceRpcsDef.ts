import { Rpc, RpcGroup } from "effect/unstable/rpc";
import * as Schema from "effect/Schema";

import { RpcActionForbiddenError } from "../errors/common.ts";
import { RpcPaywallNotFoundError } from "../errors/paywall.ts";
import {
  RpcComponentManifestInvalidError,
  RpcPaywallWorkspaceError,
} from "../errors/PaywallWorkspace.ts";
import { AuthMiddleware } from "../middlewares.ts";

/** A workspace paywall directory: stable slug + backing paywall id. */
export const WorkspacePaywallDir = Schema.Struct({
  slug: Schema.String,
  paywallId: Schema.String,
});
export type WorkspacePaywallDir = typeof WorkspacePaywallDir.Type;

/** One cached compile diagnostic (message + optional position/phase). */
export const ComponentManifestDiagnostic = Schema.Struct({
  message: Schema.String,
  phase: Schema.optional(Schema.String),
  line: Schema.optional(Schema.Number),
  column: Schema.optional(Schema.Number),
});
export type ComponentManifestDiagnostic = typeof ComponentManifestDiagnostic.Type;

/**
 * Paywall workspace RPC surface. Read side: list a project's paywall directories
 * and read a paywall's live document as cleaned JSON (the AI `read_paywall`
 * tool), plus the browser's fire-and-forget manifest upload feeding the
 * content-addressed cache. Component edits go through the document-first AI/MCP
 * `edit_paywall` / `write_component` tools; there is no whole-fork apply.
 */
export class PaywallWorkspaceRpcsDef extends RpcGroup.make(
  Rpc.make("ListWorkspacePaywalls", {
    error: Schema.Union([RpcActionForbiddenError, RpcPaywallWorkspaceError]),
    payload: Schema.Struct({
      projectId: Schema.String,
    }),
    success: Schema.Array(WorkspacePaywallDir),
  }),
  /**
   * Read another paywall's live document as cleaned JSON for reference (the AI
   * `read_paywall` tool). The `document` is the schema-loose cleaned tree
   * (`serializeDocument` output — nested `{ id, type, name?, ...data, children }`
   * nodes with defaults stripped); it is not modelled field-by-field here because
   * the document shape is intentionally open (mirrors `RecordComponentManifest`'s
   * `Schema.Unknown` manifest). Read-only.
   */
  Rpc.make("ReadPaywallDocument", {
    error: Schema.Union([
      RpcActionForbiddenError,
      RpcPaywallNotFoundError,
      RpcPaywallWorkspaceError,
    ]),
    payload: Schema.Struct({
      projectId: Schema.String,
      slug: Schema.String,
    }),
    success: Schema.Struct({
      slug: Schema.String,
      name: Schema.String,
      paywallId: Schema.String,
      /** Cleaned document JSON (loose — `serializeDocument` output). */
      document: Schema.Unknown,
    }),
  }),
  Rpc.make("RecordComponentManifest", {
    error: Schema.Union([RpcComponentManifestInvalidError, RpcPaywallWorkspaceError]),
    payload: Schema.Struct({
      sourceHash: Schema.String,
      status: Schema.Literals(["ready", "error"]),
      // Validated server-side against the ComponentManifest schema; `undefined`
      // for `error` uploads.
      manifest: Schema.optional(Schema.Unknown),
      previewTrees: Schema.optional(Schema.Record(Schema.String, Schema.Unknown)),
      diagnostics: Schema.optional(Schema.Array(ComponentManifestDiagnostic)),
    }),
    success: Schema.Void,
  }),
).middleware(AuthMiddleware) {}
