import { Context, type Effect, Schema } from "effect";

/**
 * Catch-all error for {@link MimicHost} operations. Adapters wrap any
 * mimic-db failure (RPC transport errors, provisioning conflicts that could
 * not be resolved, token minting failures) into this single tag so the RPC
 * handler's catch boundary stays small.
 */
export class MimicHostError extends Schema.TaggedErrorClass<MimicHostError>("MimicHostError")(
  "MimicHostError",
  {
    cause: Schema.String,
    message: Schema.String,
  },
) {}

/**
 * Short-lived credential for one paywall designer document: the in-band WS
 * auth `token`, the absolute `ws(s)://` connection `url` minted by mimic-db,
 * and the locally synthesized expiry instant.
 */
export interface PaywallEditToken {
  readonly token: string;
  readonly url: string;
  readonly expiresAt: Date;
}

/**
 * The current live document for a paywall as the write path needs it: the RAW
 * encoded document tree (the `TreeValue` that `reconcile()` and the workspace
 * lowerings consume as `liveTree`), its optimistic-concurrency `version`, AND the
 * decoded renderer `root` — all captured from ONE consistent read.
 *
 * `tree` is typed `unknown` so `packages/core` stays free of the `mimic-core`
 * value types; the pure workspace layer that consumes it narrows structurally
 * (a well-formed paywall document is the encoded `{kind: "tree", nodes}` value).
 * The write path reconciles against the encoded `tree`; the read/render path
 * narrows the decoded `root`.
 *
 * `root` is the SAME decoded root {@link MimicHostShape.getPaywallSnapshot}
 * returns (`roots[0]`, the renderer `SnapshotNode`), carried here so a caller
 * that needs BOTH the version and the printed files derives them atomically from
 * one read — a snapshot read taken separately could straddle a concurrent write
 * and pair a version with files from a different document state.
 */
export interface PaywallDocument {
  readonly tree: unknown;
  readonly version: number;
  readonly root: unknown;
}

/** Presence identity published for a connected AI editing participant. */
export interface AgentPaywallPresence {
  readonly editSessionId: string;
  readonly source: "built_in" | "mcp";
  readonly name: string;
}

/**
 * The result of submitting a granular transaction: whether the document DO
 * accepted it (optimistic-concurrency check on `baseVersion` passed and the
 * commands applied), and the resulting document `version`. A rejected submit
 * (`accepted: false`) is a version conflict or an invalid command batch — an
 * *expected* outcome the caller handles (re-read + re-reconcile), never a
 * defect.
 */
export interface SubmitPaywallTransactionResult {
  readonly accepted: boolean;
  readonly version: number;
}

export interface MimicHostShape {
  /**
   * Guarantees the designer document for `paywallId` exists on the mimic
   * host (document id = paywall id), seeding a fresh document with the
   * initial paywall content when absent. Idempotent — a concurrent create by
   * another isolate counts as success.
   */
  readonly ensurePaywallDocument: (paywallId: string) => Effect.Effect<void, MimicHostError>;

  /**
   * Mints a single-use write token + WS connection URL for the paywall's
   * designer document. Callers should {@link ensurePaywallDocument} first so
   * the token always points at an existing document.
   */
  readonly createPaywallEditToken: (input: {
    readonly paywallId: string;
  }) => Effect.Effect<PaywallEditToken, MimicHostError>;

  /**
   * Reads the current document snapshot for `paywallId` (document id = paywall
   * id) and returns its decoded ROOT node — the renderer `SnapshotNode` shape
   * (`{id, type, parentId, pos, data, children}`), i.e. `roots[0]` of the
   * engine's roots array. Typed as `unknown` so `packages/core` stays free of
   * the renderer type packages; the {@link SnapshotImageRenderer} adapter that
   * consumes it narrows structurally. Callers should
   * {@link ensurePaywallDocument} first so the read always hits an existing
   * document.
   */
  readonly getPaywallSnapshot: (paywallId: string) => Effect.Effect<unknown, MimicHostError>;

  /**
   * Reads the RAW encoded document tree + `version` + decoded render `root` for
   * `paywallId` — the input the workspace write path reconciles against, plus the
   * decoded root a caller projects printed files off (see {@link PaywallDocument}).
   * All three come from ONE `.get()` so a caller needing both the version and the
   * printed files derives them atomically (no snapshot/version straddle across a
   * concurrent write). Callers should {@link ensurePaywallDocument} first.
   */
  readonly getPaywallDocument: (
    paywallId: string,
  ) => Effect.Effect<PaywallDocument, MimicHostError>;

  /** Opens a leased agent participant connection and publishes its presence. */
  readonly openPaywallConnection: (input: {
    readonly paywallId: string;
    readonly connectionId: string;
    readonly presence: AgentPaywallPresence;
  }) => Effect.Effect<PaywallDocument, MimicHostError>;

  /** Reads through an active agent connection and renews its lease. */
  readonly getConnectedPaywallDocument: (input: {
    readonly paywallId: string;
    readonly connectionId: string;
  }) => Effect.Effect<PaywallDocument, MimicHostError>;

  /** Renews an active agent connection without reading the document. */
  readonly heartbeatPaywallConnection: (input: {
    readonly paywallId: string;
    readonly connectionId: string;
  }) => Effect.Effect<void, MimicHostError>;

  /** Closes an agent connection and removes its presence from the document. */
  readonly closePaywallConnection: (input: {
    readonly paywallId: string;
    readonly connectionId: string;
  }) => Effect.Effect<void, MimicHostError>;

  /**
   * Submits a granular transaction (a plain mimic `Command[]` batch at
   * `baseVersion`) to the paywall's document DO, which linearizes it against
   * concurrent writers and — on accept — fans it out to every connected WS
   * client (this fanout is how a server/agent edit reaches an open designer).
   *
   * Returns {@link SubmitPaywallTransactionResult}: `accepted: false` is a
   * version conflict or invalid batch (an expected outcome the caller retries),
   * not a {@link MimicHostError} — the error channel is reserved for transport /
   * host failures. `commands` is typed `unknown[]` so core stays free of the
   * `mimic-core` `Command` type; the adapter passes them straight through the
   * transaction envelope.
   */
  readonly submitPaywallTransaction: (
    paywallId: string,
    input: {
      readonly baseVersion: number;
      readonly commands: ReadonlyArray<unknown>;
    },
  ) => Effect.Effect<SubmitPaywallTransactionResult, MimicHostError>;

  /** Submits a granular transaction through an active agent connection. */
  readonly submitConnectedPaywallTransaction: (
    paywallId: string,
    connectionId: string,
    input: {
      readonly baseVersion: number;
      readonly commands: ReadonlyArray<unknown>;
    },
  ) => Effect.Effect<SubmitPaywallTransactionResult, MimicHostError>;
}

/**
 * Provider-agnostic port for the mimic-db document host backing the paywall
 * designer. The live adapter (over `@voidhash/mimic-server`'s `MimicSDK`
 * and the Worker's `MIMIC_HOST` service binding) is wired by the application
 * root — core code only touches the tag, keeping mimic SDK dependencies out
 * of `packages/core` and the service trivially fakeable in tests.
 */
export class MimicHost extends Context.Service<MimicHost, MimicHostShape>()("MimicHost") {}
