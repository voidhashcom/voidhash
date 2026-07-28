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
} from "@orbian/sdk/DurableEntity";
import { Context, Effect, Semaphore } from "effect";

declare class WebSocketPair {
  readonly 0: WebSocket;
  readonly 1: WebSocket;
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
    get(key: string): Promise<unknown | undefined>;
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
  timestamp: Date.now(),
});

const streamFn: StreamFn = (_model, context) => {
  const stream = createAssistantMessageEventStream();
  const userCount = context.messages.filter((message) => message.role === "user").length;
  const latest = context.messages.at(-1);
  const message =
    latest?.role === "toolResult"
      ? response([{ type: "text", text: `completed-${userCount}` }], "stop")
      : response(
          [
            {
              type: "toolCall",
              id: `probe-call-${userCount}`,
              name: "probe_effect",
              arguments: { value: `turn-${userCount}` },
            },
          ],
          "toolUse",
        );
  void (async () => {
    if (userCount === 1 && latest?.role === "user") {
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
    stream.push({ type: "start", partial: { ...message, content: [] } });
    stream.push({
      type: "done",
      reason: message.stopReason as "stop" | "toolUse",
      message,
    });
  })();
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

const makeSession = (id: string, socket: ProbeSocket): DurableEntitySession => ({
  id,
  send: (message) =>
    Effect.sync(() =>
      socket.send(typeof message === "string" ? message : (message.slice().buffer as ArrayBuffer)),
    ),
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
              put: (key, value) =>
                Effect.promise(async () => {
                  await state.storage.put(key, value);
                }),
              delete: (key) =>
                Effect.promise(async () => {
                  await state.storage.delete(key);
                }),
            },
            alarm: {
              get: Effect.promise(async () => (await state.storage.getAlarm()) ?? undefined),
              set: (scheduledTime) =>
                Effect.promise(async () => {
                  await state.storage.setAlarm(scheduledTime);
                }),
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

  #connection(socket: ProbeSocket): AgentSessionConnection<void> {
    const attachment = socket.deserializeAttachment<{ readonly connectionId: string }>();
    if (attachment === null) throw new Error("Missing probe socket attachment");
    const session =
      this.#sessions.get(attachment.connectionId) ?? makeSession(attachment.connectionId, socket);
    this.#sessions.set(attachment.connectionId, session);
    return { sessionId: this.#sessionId, owner, session, data: undefined };
  }

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get("upgrade")?.toLowerCase() !== "websocket") {
      return new Response("Expected Upgrade: websocket", { status: 426 });
    }
    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1] as ProbeSocket;
    const connectionId = crypto.randomUUID();
    server.serializeAttachment({ connectionId });
    this.state.acceptWebSocket(server);
    const connection = this.#connection(server);
    await Effect.runPromise(this.#core.connect(connection));
    return new Response(null, { status: 101, webSocket: client } as ResponseInit);
  }

  async webSocketMessage(socket: ProbeSocket, message: string | ArrayBuffer): Promise<void> {
    const frame = typeof message === "string" ? message : new Uint8Array(message);
    await Effect.runPromise(this.#core.handleMessage(this.#connection(socket), frame));
  }

  async webSocketClose(socket: ProbeSocket): Promise<void> {
    const attachment = socket.deserializeAttachment<{ readonly connectionId: string }>();
    if (attachment !== null) {
      this.#sessions.delete(attachment.connectionId);
      await Effect.runPromise(this.#core.disconnect(this.#sessionId, attachment.connectionId));
    }
  }

  async alarm(): Promise<void> {
    await Effect.runPromise(this.#core.onAlarm(this.#sessionId));
  }
}

export default {
  fetch(request: Request, env: ProbeEnvironment): Promise<Response> {
    const id = env.PROBE_SESSION.idFromName("multi-turn");
    return env.PROBE_SESSION.get(id).fetch(request);
  },
};
