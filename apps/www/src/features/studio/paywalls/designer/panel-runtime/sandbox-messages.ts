/**
 * The strict postMessage protocol between the host and a LIVE panel sandbox
 * iframe. Every message carries `protocol: 1` and a `sessionId`; the host
 * regenerates the `sessionId` on every init/restart so ghost messages from a
 * torn-down iframe are dropped by shape (a stale `sessionId` never matches).
 *
 * This module is the wire-format authority for BOTH directions. Unlike the
 * preview sandbox (a one-shot request/response), the panel sandbox is a
 * long-lived, high-frequency channel: React state, effects, and timers run
 * inside the guest for the session's lifetime, and it streams full
 * {@link PanelTree}s (rAF-coalesced guest-side) back on every commit.
 *
 * The host trusts NOTHING inbound. Guest→host messages are decoded here at the
 * ENVELOPE level only — `panel/tree.tree` and `panel/intent.intents` stay
 * `unknown`, because the tree is value-validated by {@link decodePanelTree} and
 * the intents are value-validated by the intent executor (the panel-slot's
 * concern). A malformed or oversized inbound message decodes to a violation
 * result, which the host counts against its protocol-violation budget.
 *
 * Byte-size pre-check: inbound messages are size-capped BEFORE decode
 * (`treeBytes + envelope slack` for `panel/tree`, `intentChannelBytes` for
 * `panel/intent`, a small fixed cap for control messages), mirroring the
 * cap discipline the preview sandbox host applies to returned trees.
 */
import { PANEL_CAPS } from "@voidhash/paywalls/schema";
import { Schema } from "effect";

import { strictParseOptions } from "./schema";

/** The single protocol version this host speaks. Bumped on any wire change. */
export const PANEL_SANDBOX_PROTOCOL = 1 as const;

/**
 * Serialized-message byte caps, enforced BEFORE decode on inbound messages.
 *
 * - `tree` allows the full {@link PANEL_CAPS.treeBytes} plus envelope slack (the
 *   JSON wrapper: `protocol`, `sessionId`, `type`, `revision`, key overhead).
 * - `intent` allows the whole intent channel budget (a batch of intents, each
 *   capped value-side at {@link PANEL_CAPS.intentBytes} by the executor) plus
 *   slack; sized generously so a legitimate coalesced batch is never clipped
 *   by the transport before the executor can rate/size it.
 * - `control` bounds `panel/event` (dispatch args) and every fixed-size control
 *   message (`ready`, `pong`, `error`, `ping`).
 */
export const PANEL_MESSAGE_BYTE_CAPS = {
  /** `panel/tree`: full tree budget + JSON envelope slack. */
  tree: PANEL_CAPS.treeBytes + 8192,
  /** `panel/intent`: a coalesced batch of intents + envelope slack. */
  intent: PANEL_CAPS.intentBytes * 8 + 8192,
  /** `panel/event` + all fixed control messages. */
  control: PANEL_CAPS.intentBytes + 8192,
} as const;

// =============================================================================
// Shared envelope fields
// =============================================================================

const ProtocolField = Schema.Literal(PANEL_SANDBOX_PROTOCOL);
const SessionIdField = Schema.String;

// =============================================================================
// Host → guest messages
// =============================================================================

/**
 * The serializable init payload the host hands the guest: the OSS sandbox IIFE
 * bundle (evaluated once to install the guest global + require shim), the
 * compiled author module (CJS), and the initial session inputs. `sandboxCode`
 * is optional so a re-init on an already-warm guest can skip re-shipping the
 * (large) bundle — the guest evaluates it only if the global is not yet set.
 */
const HostInitSchema = Schema.Struct({
  protocol: ProtocolField,
  sessionId: SessionIdField,
  type: Schema.Literal("panel/init"),
  sandboxCode: Schema.optional(Schema.String),
  compiledCode: Schema.String,
  inputs: Schema.Unknown,
});

const HostUpdateSchema = Schema.Struct({
  protocol: ProtocolField,
  sessionId: SessionIdField,
  type: Schema.Literal("panel/update"),
  inputs: Schema.Unknown,
});

const HostEventSchema = Schema.Struct({
  protocol: ProtocolField,
  sessionId: SessionIdField,
  type: Schema.Literal("panel/event"),
  nodeId: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
  name: Schema.String,
  args: Schema.Array(Schema.Unknown),
});

const HostPingSchema = Schema.Struct({
  protocol: ProtocolField,
  sessionId: SessionIdField,
  type: Schema.Literal("panel/ping"),
  seq: Schema.Int,
});

const HostUnmountSchema = Schema.Struct({
  protocol: ProtocolField,
  sessionId: SessionIdField,
  type: Schema.Literal("panel/unmount"),
});

/** The closed union of every host→guest message. */
export const HostMessageSchema = Schema.Union([
  HostInitSchema,
  HostUpdateSchema,
  HostEventSchema,
  HostPingSchema,
  HostUnmountSchema,
]);

/** A decoded host→guest message (what the guest driver receives). */
export type HostMessage = typeof HostMessageSchema.Type;
export type HostInitMessage = typeof HostInitSchema.Type;
export type HostUpdateMessage = typeof HostUpdateSchema.Type;
export type HostEventMessage = typeof HostEventSchema.Type;
export type HostPingMessage = typeof HostPingSchema.Type;
export type HostUnmountMessage = typeof HostUnmountSchema.Type;

// =============================================================================
// Guest → host messages
// =============================================================================

const GuestReadySchema = Schema.Struct({
  protocol: ProtocolField,
  sessionId: SessionIdField,
  type: Schema.Literal("panel/ready"),
});

/**
 * A serialized tree emission. `tree` is left `Unknown` deliberately: the host
 * re-validates it value-level with {@link decodePanelTree}. `revision` is the
 * guest's monotonically-increasing commit counter; the host applies
 * latest-revision-wins and drops stale emissions.
 */
const GuestTreeSchema = Schema.Struct({
  protocol: ProtocolField,
  sessionId: SessionIdField,
  type: Schema.Literal("panel/tree"),
  revision: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
  tree: Schema.Unknown,
});

/**
 * A batch of intents. `intents` stays an array of `Unknown`: the host forwards
 * the RAW payload to `onIntents`, and the intent executor (panel-slot side)
 * performs value-level validation + size/rate limiting on each intent.
 */
const GuestIntentSchema = Schema.Struct({
  protocol: ProtocolField,
  sessionId: SessionIdField,
  type: Schema.Literal("panel/intent"),
  intents: Schema.Array(Schema.Unknown),
});

const GuestPongSchema = Schema.Struct({
  protocol: ProtocolField,
  sessionId: SessionIdField,
  type: Schema.Literal("panel/pong"),
  seq: Schema.Int,
});

const GuestErrorSchema = Schema.Struct({
  protocol: ProtocolField,
  sessionId: SessionIdField,
  type: Schema.Literal("panel/error"),
  phase: Schema.Literals(["init", "render", "runtime"]),
  message: Schema.String,
});

/** The closed union of every guest→host message. */
export const GuestMessageSchema = Schema.Union([
  GuestReadySchema,
  GuestTreeSchema,
  GuestIntentSchema,
  GuestPongSchema,
  GuestErrorSchema,
]);

/** A decoded guest→host message (what the host receives). */
export type GuestMessage = typeof GuestMessageSchema.Type;
export type GuestReadyMessage = typeof GuestReadySchema.Type;
export type GuestTreeMessage = typeof GuestTreeSchema.Type;
export type GuestIntentMessage = typeof GuestIntentSchema.Type;
export type GuestPongMessage = typeof GuestPongSchema.Type;
export type GuestErrorMessage = typeof GuestErrorSchema.Type;

// =============================================================================
// Encode / decode
// =============================================================================

const encodeHost = Schema.encodeUnknownSync(HostMessageSchema, strictParseOptions);
const decodeHost = Schema.decodeUnknownSync(HostMessageSchema, strictParseOptions);
const encodeGuest = Schema.encodeUnknownSync(GuestMessageSchema, strictParseOptions);
const decodeGuest = Schema.decodeUnknownSync(GuestMessageSchema, strictParseOptions);

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const byteLength = (input: string): number => new TextEncoder().encode(input).length;

/**
 * The byte cap that applies to a message, keyed off its `type` before decode.
 * Unknown / typeless shapes get the (largest) tree cap so a genuinely huge
 * blob is still rejected while an about-to-be-rejected tiny malformed message
 * is never clipped early.
 */
const inboundByteCap = (type: unknown): number => {
  if (type === "panel/tree") return PANEL_MESSAGE_BYTE_CAPS.tree;
  if (type === "panel/intent") return PANEL_MESSAGE_BYTE_CAPS.intent;
  return PANEL_MESSAGE_BYTE_CAPS.control;
};

/** Discriminated decode result: a valid message, or a violation with a reason. */
export type DecodeMessageResult<T> =
  | { readonly ok: true; readonly message: T }
  | { readonly ok: false; readonly error: string };

/**
 * Encodes a host→guest message to the strict wire shape. Throws (host bug) if
 * the message is malformed — the host constructs these, so a failure is a
 * programming error, not untrusted input.
 */
export const encodeHostMessage = (message: HostMessage): HostMessage =>
  encodeHost(message) as HostMessage;

/**
 * Encodes a guest→host message. Used only by the guest driver (and its tests);
 * the guest constructs these, so a failure is a driver bug.
 */
export const encodeGuestMessage = (message: GuestMessage): GuestMessage =>
  encodeGuest(message) as GuestMessage;

/**
 * The GUEST's gate for an inbound host→guest message: a byte-size pre-check
 * keyed off the raw `type`, then a strict envelope decode. Never throws —
 * malformed/oversized input decodes to a violation the guest can ignore.
 */
export const decodeHostMessage = (input: unknown): DecodeMessageResult<HostMessage> => {
  const capResult = checkInboundBytes(input);
  if (capResult !== null) return { ok: false, error: capResult };
  try {
    return { ok: true, message: decodeHost(input) };
  } catch (error) {
    return { ok: false, error: `invalid host message: ${errorMessage(error)}` };
  }
};

/**
 * The HOST's gate for an inbound guest→host message: a byte-size pre-check
 * keyed off the raw `type`, then a strict envelope decode. The `tree`/`intents`
 * payloads stay `unknown` (value-validated downstream). Never throws — a
 * violation is counted against the host's protocol-violation budget.
 */
export const decodeGuestMessage = (input: unknown): DecodeMessageResult<GuestMessage> => {
  const capResult = checkInboundBytes(input);
  if (capResult !== null) return { ok: false, error: capResult };
  try {
    return { ok: true, message: decodeGuest(input) };
  } catch (error) {
    return { ok: false, error: `invalid guest message: ${errorMessage(error)}` };
  }
};

/**
 * Byte-size pre-check shared by both inbound gates. Returns a violation reason
 * string when the serialized message exceeds its per-type cap, or `null` when
 * within budget. A message that cannot be serialized (cycles) is itself a
 * violation.
 */
const checkInboundBytes = (input: unknown): string | null => {
  const type = (input as { type?: unknown } | null)?.type;
  const cap = inboundByteCap(type);
  let size: number;
  try {
    size = byteLength(JSON.stringify(input));
  } catch {
    return "message is not serializable";
  }
  if (size > cap) {
    return `message exceeds ${cap} bytes`;
  }
  return null;
};
