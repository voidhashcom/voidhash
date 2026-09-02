import type { AgentEvent } from "@earendil-works/pi-agent-core";
import type { ImageContent } from "@earendil-works/pi-ai";
import { constant } from "@voidhash/lib/lang";
import * as Schema from "effect/Schema";

/** Current WebSocket protocol version. */
export const AGENT_PROTOCOL_VERSION = constant(1);

const Version = Schema.Literal(AGENT_PROTOCOL_VERSION);
const RequestId = Schema.String;
const Image = Schema.Struct({
  type: Schema.Literal("image"),
  data: Schema.String,
  mimeType: Schema.String,
});
const TextCommand = constant({
  v: Version,
  requestId: RequestId,
  text: Schema.String,
  images: Schema.optional(Schema.Array(Image)),
});

/** Commands accepted by an agent-session WebSocket. */
export const AgentClientMessage = Schema.Union([
  Schema.Struct({ ...TextCommand, type: Schema.Literal("prompt") }),
  Schema.Struct({ ...TextCommand, type: Schema.Literal("steer") }),
  Schema.Struct({ ...TextCommand, type: Schema.Literal("follow_up") }),
  Schema.Struct({ v: Version, requestId: RequestId, type: Schema.Literal("abort") }),
  Schema.Struct({ v: Version, requestId: RequestId, type: Schema.Literal("get_state") }),
  Schema.Struct({ v: Version, requestId: RequestId, type: Schema.Literal("get_entries") }),
  Schema.Struct({
    v: Version,
    requestId: RequestId,
    type: Schema.Literal("set_model"),
    provider: Schema.String,
    modelId: Schema.String,
  }),
  Schema.Struct({
    v: Version,
    requestId: RequestId,
    type: Schema.Literal("set_context"),
    paywallId: Schema.optional(Schema.String),
    selectedNodeIds: Schema.Array(Schema.String),
  }),
]);

export type AgentClientMessage = typeof AgentClientMessage.Type;

/** Portable session owner stored with the transcript. */
export interface AgentSessionOwner {
  readonly organizationId: string;
  readonly projectId: string;
  readonly userId: string;
}

/** Mutable designer context supplied to the next model turn. */
export interface AgentSessionDynamicContext {
  readonly paywallId?: string;
  readonly selectedNodeIds: ReadonlyArray<string>;
}

/** State snapshot returned by `get_state`. */
export interface AgentSessionState {
  readonly sessionId: string;
  readonly isStreaming: boolean;
  readonly model: { readonly provider: string; readonly id: string };
  readonly entryCount: number;
  readonly context: AgentSessionDynamicContext;
}

/** Frames emitted by an agent-session WebSocket. */
export type AgentServerMessage =
  | { readonly v: 1; readonly type: "event"; readonly event: AgentEvent }
  | {
      readonly v: 1;
      readonly type: "ack";
      readonly requestId: string;
      readonly command: AgentClientMessage["type"];
    }
  | {
      readonly v: 1;
      readonly type: "error";
      readonly requestId?: string;
      readonly message: string;
    }
  | {
      readonly v: 1;
      readonly type: "state";
      readonly requestId: string;
      readonly state: AgentSessionState;
    }
  | {
      readonly v: 1;
      readonly type: "entries";
      readonly requestId: string;
      readonly entries: ReadonlyArray<unknown>;
    };

const decodeClientFrame = Schema.decodeUnknownSync(Schema.fromJsonString(AgentClientMessage));
const encodeJson = Schema.encodeSync(Schema.fromJsonString(Schema.Unknown));

/** Decodes and validates one text WebSocket command. */
export const decodeAgentClientMessage = (frame: string): AgentClientMessage =>
  decodeClientFrame(frame);

/** JSON-encodes one server frame. */
export const encodeAgentServerMessage = (message: AgentServerMessage): string =>
  encodeJson(message);

/** Converts prompt wire content into the Pi image content shape. */
export const promptImages = (
  message: Extract<AgentClientMessage, { readonly type: "prompt" | "steer" | "follow_up" }>,
): ReadonlyArray<ImageContent> => message.images ?? [];
