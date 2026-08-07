import {
  Agent,
  AgentSessionCore,
  agentSessionAddress,
  createAssistantMessageEventStream,
  makeEffectAgentTool,
  Type,
  type AgentSessionConnection,
  type AssistantMessage,
  type Model,
  type StreamFn,
} from "@voidhash/agent";
import type {
  DurableEntityHostShape,
  DurableEntitySession,
} from "@voidhash/platform/DurableEntity";
import { Clock, Context, Effect, Random, Semaphore } from "effect";

declare class WebSocketPair {
  readonly 0: WebSocket;
  readonly 1: ProbeSocket;
}

/** `ResponseInit` shape workerd accepts for a WebSocket upgrade response. */
interface WebSocketResponseInit extends ResponseInit {
  readonly webSocket: WebSocket;
}

interface ProbeEnvironment {
  readonly PROBE_SESSION: {
    idFromName(name: string): unknown;
    get(id: unknown): { fetch(request: Request): Promise<Response> };
  };
}

interface ProbeState {
  readonly id: { readonly name?: string };
  readonly storage: {
    get(key: string): Promise<unknown>;
    put(key: string, value: unknown): Promise<void>;
    delete(key: string): Promise<boolean>;
    getAlarm(): Promise<number | null>;
    setAlarm(scheduledTime: number): Promise<void>;
    deleteAlarm(): Promise<void>;
  };
  acceptWebSocket(socket: WebSocket): void;
}

interface ProbeSocket extends WebSocket {
  deserializeAttachment<T>(): T | null;
  serializeAttachment(value: unknown): void;
}

const model: Model<string> = {
  id: "workerd-do-probe",
  name: "Workerd DO probe",
  api: "workerd-do-probe",
  provider: "workerd-do-probe",
  baseUrl: "",
  reasoning: false,
  input: ["text"],
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  contextWindow: 1_000,
  maxTokens: 100,
};

const usage = {
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0,
  totalTokens: 0,
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
};

const response = (
  content: AssistantMessage["content"],
  stopReason: "stop" | "toolUse",
): AssistantMessage => ({
  role: "assistant",
  content,
  api: model.api,
  provider: model.provider,
  model: model.id,
  usage,
  stopReason,
  timestamp: Effect.runSync(Clock.currentTimeMillis),
});

const probeReply = (
  latestRole: string | undefined,
  userCount: number,
): { readonly message: AssistantMessage; readonly reason: "stop" | "toolUse" } => {
  if (latestRole === "toolResult") {
    return {
      message: response([{ type: "text", text: `completed-${userCount}` }], "stop"),
      reason: "stop",
    };
  }
  return {
    message: response(
      [
        {
          type: "toolCall",
          id: `probe-call-${userCount}`,
          name: "probe_effect",
          arguments: { value: `turn-${userCount}` },
        },
      ],
      "toolUse",
    ),
    reason: "toolUse",
  };
};

const streamFn: StreamFn = (_model, context) => {
  const stream = createAssistantMessageEventStream();
  const userCount = context.messages.filter((message) => message.role === "user").length;
  const latest = context.messages.at(-1);
  const { message, reason } = probeReply(latest?.role, userCount);
  Effect.runFork(
    Effect.gen(function* () {
      if (userCount === 1 && latest?.role === "user") {
        yield* Effect.sleep("150 millis");
      }
      stream.push({ type: "start", partial: { ...message, content: [] } });
      stream.push({
        type: "done",
        reason,
        message,
      });
    }),
  );
  return stream;
};

const probeTool = makeEffectAgentTool<
  { readonly value: string },
  { readonly echoed: string },
  never,
  never
>(
  {
    name: "probe_effect",
    label: "Effect probe",
    description: "Returns its input through an Effect-backed Pi tool.",
    parameters: Type.Object({ value: Type.String() }),
    effectHandler: ({ value }) =>
      Effect.succeed({
        content: [{ type: "text", text: value }],
        details: { echoed: value },
      }),
  },
  Context.empty(),
);

const socketPayload = (message: string | Uint8Array): string | ArrayBuffer => {
  if (typeof message === "string") return message;
  return message.slice().buffer;
};

const socketFrame = (message: string | ArrayBuffer): string | Uint8Array => {
  if (typeof message === "string") return message;
  return new Uint8Array(message);
};

const makeSession = (id: string, socket: ProbeSocket): DurableEntitySession => ({
  id,
  send: (message) => Effect.sync(() => socket.send(socketPayload(message))),
  close: (code = 1000, reason = "") => Effect.sync(() => socket.close(code, reason)),
  getAttachment: Effect.sync(() => socket.deserializeAttachment() ?? undefined),
  setAttachment: (attachment) => Effect.sync(() => socket.serializeAttachment(attachment)),
});

const owner = { organizationId: "probe-org", projectId: "probe-project", userId: "probe-user" };

export class ProbeSession {
  readonly #sessionId: string;
  readonly #sessions = new Map<string, DurableEntitySession>();
  readonly #core: AgentSessionCore<void>;

  constructor(readonly state: ProbeState) {
    this.#sessionId = state.id.name ?? "probe";
    const address = agentSessionAddress(this.#sessionId);
    const lock = Semaphore.makeUnsafe(1);
    const host: DurableEntityHostShape = {
      run: (requested, operation) => {
        if (requested.type !== address.type || requested.id !== address.id) {
          return Effect.die(new Error("Probe Durable Object received a foreign address"));
        }
        return lock.withPermit(
          operation({
            address,
            keyValue: {
              get: (key) => Effect.promise(() => state.storage.get(key)),
              put: (key, value) => Effect.promise(() => state.storage.put(key, value)),
              delete: (key) => Effect.asVoid(Effect.promise(() => state.storage.delete(key))),
            },
            alarm: {
              get: Effect.map(
                Effect.promise(() => state.storage.getAlarm()),
                (scheduledTime) => scheduledTime ?? undefined,
              ),
              set: (scheduledTime) =>
                Effect.promise(() => state.storage.setAlarm(scheduledTime)),
              delete: Effect.promise(() => state.storage.deleteAlarm()),
            },
            sessions: {
              get: (id) => Effect.succeed(this.#sessions.get(id)),
              list: Effect.sync(() => [...this.#sessions.values()]),
              attach: (session) =>
                Effect.sync(() => {
                  this.#sessions.set(session.id, session);
                }),
              remove: (id) =>
                Effect.sync(() => {
                  this.#sessions.delete(id);
                }),
            },
          }),
        );
      },
    };
    this.#core = new AgentSessionCore({
      host,
      factory: {
        create: ({ messages }) =>
          new Agent({
            initialState: {
              model,
              messages: [...messages],
              systemPrompt: "Run the probe tool once per request.",
              tools: [probeTool],
            },
            streamFn,
          }),
        resolveModel: () => model,
      },
    });
  }

  #connection(socket: ProbeSocket): Effect.Effect<AgentSessionConnection<void>> {
    return Effect.suspend(() => {
      const attachment = socket.deserializeAttachment<{ readonly connectionId: string }>();
      if (attachment === null) return Effect.die(new Error("Missing probe socket attachment"));
      const session =
        this.#sessions.get(attachment.connectionId) ?? makeSession(attachment.connectionId, socket);
      this.#sessions.set(attachment.connectionId, session);
      return Effect.succeed({
        sessionId: this.#sessionId,
        owner,
        session,
        data: undefined,
      });
    });
  }

  fetch(request: Request): Promise<Response> {
    const core = this.#core;
    const state = this.state;
    const connectionFor = (socket: ProbeSocket) => this.#connection(socket);
    return Effect.runPromise(
      Effect.gen(function* () {
        if (request.headers.get("upgrade")?.toLowerCase() !== "websocket") {
          return new Response("Expected Upgrade: websocket", { status: 426 });
        }
        const pair = new WebSocketPair();
        const client = pair[0];
        const server = pair[1];
        const connectionId = `probe-connection-${yield* Random.nextInt}`;
        server.serializeAttachment({ connectionId });
        state.acceptWebSocket(server);
        const connection = yield* connectionFor(server);
        yield* core.connect(connection);
        const init: WebSocketResponseInit = { status: 101, webSocket: client };
        return new Response(null, init);
      }),
    );
  }

  webSocketMessage(socket: ProbeSocket, message: string | ArrayBuffer): Promise<void> {
    const core = this.#core;
    const connectionFor = (probe: ProbeSocket) => this.#connection(probe);
    return Effect.runPromise(
      Effect.gen(function* () {
        const connection = yield* connectionFor(socket);
        yield* core.handleMessage(connection, socketFrame(message));
      }),
    );
  }

  webSocketClose(socket: ProbeSocket): Promise<void> {
    const core = this.#core;
    const sessions = this.#sessions;
    const sessionId = this.#sessionId;
    return Effect.runPromise(
      Effect.gen(function* () {
        const attachment = socket.deserializeAttachment<{ readonly connectionId: string }>();
        if (attachment === null) return;
        sessions.delete(attachment.connectionId);
        yield* core.disconnect(sessionId, attachment.connectionId);
      }),
    );
  }

  alarm(): Promise<void> {
    return Effect.runPromise(Effect.asVoid(this.#core.onAlarm(this.#sessionId)));
  }
}

export default {
  fetch(request: Request, env: ProbeEnvironment): Promise<Response> {
    const id = env.PROBE_SESSION.idFromName("multi-turn");
    return env.PROBE_SESSION.get(id).fetch(request);
  },
};
