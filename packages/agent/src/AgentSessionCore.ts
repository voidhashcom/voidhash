import { Agent, type AgentEvent, type AgentMessage } from "@earendil-works/pi-agent-core";
import type { ImageContent, Model } from "@earendil-works/pi-ai";
import {
  type DurableEntityAddress,
  type DurableEntityHostShape,
  type DurableEntitySession,
  makeDurableEntityAddress,
} from "@voidhash/platform/DurableEntity";
import { causeMessage } from "@voidhash/lib/lang";
import { Clock, Data, Effect, Semaphore } from "effect";

import {
  AGENT_PROTOCOL_VERSION,
  type AgentClientMessage,
  type AgentServerMessage,
  type AgentSessionDynamicContext,
  type AgentSessionOwner,
  decodeAgentClientMessage,
  encodeAgentServerMessage,
  promptImages,
} from "./Protocol.ts";
import {
  appendSessionLog,
  ensureSessionOwner,
  messagesFromSessionLog,
  readSessionLog,
  readSessionLogCount,
  type SessionLogEntry,
  type SessionLogEntryInput,
} from "./SessionLog.ts";

/** Durable-entity type used for every agent session. */
export const AGENT_SESSION_ENTITY_TYPE = "agent-session";

/** Creates the stable durable-entity address for one agent session. */
export const agentSessionAddress = (sessionId: string): DurableEntityAddress =>
  makeDurableEntityAddress(AGENT_SESSION_ENTITY_TYPE, sessionId);

/** Runtime input supplied by an authenticated host when a socket connects. */
export interface AgentSessionConnection<ConnectionData = unknown> {
  readonly sessionId: string;
  readonly owner: AgentSessionOwner;
  readonly session: DurableEntitySession;
  readonly data: ConnectionData;
  readonly metadata?: AgentSessionMetadata;
}

/** Searchable metadata maintained outside the durable transcript. */
export interface AgentSessionMetadata {
  readonly surface: string;
  readonly paywallId?: string | null;
}

/** Mutable references made available while the host constructs a Pi agent. */
export interface AgentSessionFactoryInput<ConnectionData> {
  readonly sessionId: string;
  readonly owner: AgentSessionOwner;
  readonly connectionData: ConnectionData;
  readonly messages: ReadonlyArray<AgentMessage>;
  readonly dynamicContext: { current: AgentSessionDynamicContext };
  readonly metadata?: AgentSessionMetadata;
}

/** Host-specific Pi agent and model construction boundary. */
export interface AgentSessionFactory<ConnectionData = unknown> {
  readonly create: (input: AgentSessionFactoryInput<ConnectionData>) => Promise<Agent> | Agent;
  readonly preparePrompt?: (input: {
    readonly agent: Agent;
    readonly message: AgentMessage;
    readonly sessionId: string;
    readonly owner: AgentSessionOwner;
    readonly connectionData: ConnectionData;
    readonly dynamicContext: { current: AgentSessionDynamicContext };
  }) => Promise<void> | void;
  readonly resolveModel: (
    provider: string,
    modelId: string,
    connectionData: ConnectionData,
  ) => Promise<Model<string> | undefined> | Model<string> | undefined;
}

/** Optional persistence hook for the Postgres session index. */
export interface AgentSessionIndex<ConnectionData = unknown> {
  readonly touch: (input: {
    readonly sessionId: string;
    readonly owner: AgentSessionOwner;
    readonly title?: string;
    readonly metadata?: AgentSessionMetadata;
    readonly connectionData: ConnectionData;
  }) => Promise<void>;
}

/** Configuration for {@link AgentSessionCore}. */
export interface AgentSessionCoreOptions<ConnectionData> {
  readonly host: DurableEntityHostShape;
  readonly factory: AgentSessionFactory<ConnectionData>;
  readonly idleTimeoutMs?: number;
  readonly now?: () => number;
  readonly index?: AgentSessionIndex<ConnectionData>;
}

interface LiveAgentSession<ConnectionData> {
  readonly agent: Agent;
  readonly owner: AgentSessionOwner;
  readonly connectionData: ConnectionData;
  readonly dynamicContext: { current: AgentSessionDynamicContext };
  metadata: AgentSessionMetadata | undefined;
  readonly unsubscribe: () => void;
}

/** Raised when a WebSocket text frame is not a valid agent command. */
class InvalidAgentCommandError extends Data.TaggedError("InvalidAgentCommandError")<{
  readonly message: string;
}> {}

const sameOwner = (left: AgentSessionOwner, right: AgentSessionOwner): boolean =>
  left.organizationId === right.organizationId &&
  left.projectId === right.projectId &&
  left.userId === right.userId;

const isPromiseLike = <A>(value: Promise<A> | A): value is Promise<A> => {
  if (typeof value !== "object" || value === null) return false;
  if (!("then" in value)) return false;
  return typeof value.then === "function";
};

/** Awaits a host callback that may answer either synchronously or with a promise. */
const fromMaybePromise = <A>(thunk: () => Promise<A> | A): Effect.Effect<A> =>
  Effect.suspend(() => {
    const value = thunk();
    if (isPromiseLike(value)) return Effect.promise(() => value);
    return Effect.succeed(value);
  });

const touchIndex = <ConnectionData>(
  index: AgentSessionIndex<ConnectionData> | undefined,
  input: {
    readonly sessionId: string;
    readonly owner: AgentSessionOwner;
    readonly title?: string;
    readonly metadata?: AgentSessionMetadata;
    readonly connectionData: ConnectionData;
  },
): Effect.Effect<void> => {
  if (index === undefined) return Effect.void;
  return Effect.promise(() => index.touch(input));
};

const optionalPaywallId = (value: string | null | undefined): string | undefined => {
  if (typeof value === "string") return value;
  return undefined;
};

const dynamicSessionContext = (
  paywallId: string | undefined,
  selectedNodeIds: ReadonlyArray<string>,
): AgentSessionDynamicContext => {
  if (paywallId === undefined) return { selectedNodeIds };
  return { paywallId, selectedNodeIds };
};

const userMessage = (
  text: string,
  images: ReadonlyArray<ImageContent>,
): Effect.Effect<AgentMessage> =>
  Effect.gen(function* () {
    const timestamp = yield* Clock.currentTimeMillis;
    if (images.length === 0) {
      return { role: "user", content: text, timestamp } satisfies AgentMessage;
    }
    return {
      role: "user",
      content: [{ type: "text", text }, ...images],
      timestamp,
    } satisfies AgentMessage;
  });

const defaultNow = (): number => Effect.runSync(Clock.currentTimeMillis);

const titleFromText = (text: string): string => {
  const title = text.trim() || "New chat";
  if (title.length > 80) return `${title.slice(0, 79)}…`;
  return title;
};

/**
 * Portable per-session Pi harness. Long-running prompts execute directly
 * against the in-memory registry; entity turns are used only for short storage,
 * session-list, and alarm operations.
 */
export class AgentSessionCore<ConnectionData = unknown> {
  readonly #host: DurableEntityHostShape;
  readonly #factory: AgentSessionFactory<ConnectionData>;
  readonly #idleTimeoutMs: number;
  readonly #now: () => number;
  readonly #index: AgentSessionIndex<ConnectionData> | undefined;
  readonly #sessions = new Map<string, LiveAgentSession<ConnectionData>>();
  readonly #creating = new Map<string, Promise<LiveAgentSession<ConnectionData>>>();
  readonly #commandLocks = new Map<string, Semaphore.Semaphore>();

  constructor(options: AgentSessionCoreOptions<ConnectionData>) {
    this.#host = options.host;
    this.#factory = options.factory;
    this.#idleTimeoutMs = options.idleTimeoutMs ?? 5 * 60_000;
    this.#now = options.now ?? defaultNow;
    this.#index = options.index;
  }

  /** Attaches an authenticated WebSocket and verifies immutable session ownership. */
  readonly connect = (
    connection: AgentSessionConnection<ConnectionData>,
  ): Effect.Effect<boolean> => {
    const address = agentSessionAddress(connection.sessionId);
    const host = this.#host;
    const index = this.#index;
    return Effect.gen(function* () {
      const authorized = yield* ensureSessionOwner(host, address, connection.owner, sameOwner);
      if (!authorized) return false;
      yield* touchIndex(index, {
        sessionId: connection.sessionId,
        owner: connection.owner,
        metadata: connection.metadata,
        connectionData: connection.data,
      });
      yield* host.run(address, (entity) =>
        Effect.gen(function* () {
          yield* entity.sessions.attach(connection.session);
          yield* entity.alarm.delete;
        }),
      );
      return true;
    });
  };

  /** Detaches a socket and schedules idle eviction when it was the final client. */
  readonly disconnect = (sessionId: string, connectionId: string): Effect.Effect<void> => {
    const address = agentSessionAddress(sessionId);
    const now = this.#now;
    const idleTimeoutMs = this.#idleTimeoutMs;
    return this.#host.run(address, (entity) =>
      Effect.gen(function* () {
        yield* entity.sessions.remove(connectionId);
        const remaining = yield* entity.sessions.list;
        if (remaining.length === 0) {
          yield* entity.alarm.set(now() + idleTimeoutMs);
        }
      }),
    );
  };

  /** Handles one command without holding the durable entity's serialized turn. */
  readonly handleMessage = (
    connection: AgentSessionConnection<ConnectionData>,
    frame: string | Uint8Array,
  ): Effect.Effect<void> => {
    let lock = this.#commandLocks.get(connection.sessionId);
    if (lock === undefined) {
      lock = Semaphore.makeUnsafe(1);
      this.#commandLocks.set(connection.sessionId, lock);
    }
    return lock.withPermit(this.#handleMessageNow(connection, frame));
  };

  readonly #handleMessageNow = (
    connection: AgentSessionConnection<ConnectionData>,
    frame: string | Uint8Array,
  ): Effect.Effect<void> => {
    const host = this.#host;
    const factory = this.#factory;
    const index = this.#index;
    const sessions = this.#sessions;
    const getOrCreate = () => this.#getOrCreate(connection);
    const send = (message: AgentServerMessage) => this.#send(connection.session, message);
    const ack = (command: AgentClientMessage) => this.#ack(connection.session, command);
    const broadcastError = (requestId: string, message: string) =>
      this.#broadcastError(connection.sessionId, requestId, message);
    return Effect.gen(function* () {
      if (typeof frame !== "string") {
        yield* send({
          v: AGENT_PROTOCOL_VERSION,
          type: "error",
          message: "Agent commands must be UTF-8 JSON text frames",
        });
        return;
      }
      const command = yield* Effect.try({
        try: () => decodeAgentClientMessage(frame),
        catch: (cause) => new InvalidAgentCommandError({ message: causeMessage(cause) }),
      }).pipe(
        Effect.catchTag("InvalidAgentCommandError", (error) =>
          send({
            v: AGENT_PROTOCOL_VERSION,
            type: "error",
            message: `Invalid agent command: ${error.message}`,
          }).pipe(Effect.as(undefined)),
        ),
      );
      if (command === undefined) return;

      switch (command.type) {
        case "get_entries": {
          const entries = yield* readSessionLog(host, agentSessionAddress(connection.sessionId));
          yield* send({
            v: AGENT_PROTOCOL_VERSION,
            type: "entries",
            requestId: command.requestId,
            entries,
          });
          return;
        }
        case "get_state": {
          const live = yield* getOrCreate();
          const entryCount = yield* readSessionLogCount(
            host,
            agentSessionAddress(connection.sessionId),
          );
          yield* send({
            v: AGENT_PROTOCOL_VERSION,
            type: "state",
            requestId: command.requestId,
            state: {
              sessionId: connection.sessionId,
              isStreaming: live.agent.state.isStreaming,
              model: {
                provider: live.agent.state.model.provider,
                id: live.agent.state.model.id,
              },
              entryCount,
              context: live.dynamicContext.current,
            },
          });
          return;
        }
        case "set_context": {
          const live = yield* getOrCreate();
          live.dynamicContext.current = dynamicSessionContext(
            command.paywallId,
            command.selectedNodeIds,
          );
          live.metadata = {
            surface: live.metadata?.surface ?? "designer",
            paywallId: command.paywallId ?? null,
          };
          yield* touchIndex(index, {
            sessionId: connection.sessionId,
            owner: connection.owner,
            metadata: live.metadata,
            connectionData: live.connectionData,
          });
          yield* ack(command);
          return;
        }
        case "set_model": {
          const live = yield* getOrCreate();
          const model = yield* fromMaybePromise(() =>
            factory.resolveModel(command.provider, command.modelId, live.connectionData),
          );
          if (model === undefined) {
            yield* send({
              v: AGENT_PROTOCOL_VERSION,
              type: "error",
              requestId: command.requestId,
              message: `Unknown model: ${command.provider}/${command.modelId}`,
            });
            return;
          }
          live.agent.state.model = model;
          yield* appendSessionLog(host, agentSessionAddress(connection.sessionId), [
            { type: "model_change", provider: model.provider, modelId: model.id },
          ]);
          yield* ack(command);
          return;
        }
        case "abort": {
          sessions.get(connection.sessionId)?.agent.abort();
          yield* ack(command);
          return;
        }
        case "prompt":
        case "steer":
        case "follow_up": {
          const live = yield* getOrCreate();
          const images = promptImages(command);
          const message = yield* userMessage(command.text, images);
          if (command.type === "prompt") {
            if (live.agent.state.isStreaming) {
              yield* send({
                v: AGENT_PROTOCOL_VERSION,
                type: "error",
                requestId: command.requestId,
                message: "Agent is already running; use steer or follow_up",
              });
              return;
            }
            yield* fromMaybePromise(() =>
              factory.preparePrompt?.({
                agent: live.agent,
                message,
                sessionId: connection.sessionId,
                owner: connection.owner,
                connectionData: live.connectionData,
                dynamicContext: live.dynamicContext,
              }),
            );
            void live.agent
              .prompt(message)
              .catch((cause) =>
                Effect.runPromise(broadcastError(command.requestId, causeMessage(cause))),
              );
            yield* touchIndex(index, {
              sessionId: connection.sessionId,
              owner: connection.owner,
              title: titleFromText(command.text),
              metadata: live.metadata,
              connectionData: live.connectionData,
            });
          } else if (command.type === "steer") {
            live.agent.steer(message);
          } else {
            live.agent.followUp(message);
          }
          yield* ack(command);
        }
      }
    });
  };

  /** Fires one persisted idle alarm and evicts the in-memory Pi agent if unused. */
  readonly onAlarm = (sessionId: string): Effect.Effect<boolean> => {
    const address = agentSessionAddress(sessionId);
    const host = this.#host;
    const now = this.#now;
    const idleTimeoutMs = this.#idleTimeoutMs;
    const liveSessions = this.#sessions;
    const commandLocks = this.#commandLocks;
    return host.run(address, (entity) =>
      Effect.gen(function* () {
        const scheduledTime = yield* entity.alarm.get;
        if (scheduledTime === undefined || scheduledTime > now()) return false;
        const sessions = yield* entity.sessions.list;
        if (sessions.length > 0) {
          yield* entity.alarm.delete;
          return false;
        }
        const live = liveSessions.get(sessionId);
        if (live?.agent.state.isStreaming) {
          yield* entity.alarm.set(now() + idleTimeoutMs);
          return false;
        }
        yield* entity.alarm.delete;
        live?.unsubscribe();
        liveSessions.delete(sessionId);
        commandLocks.delete(sessionId);
        return true;
      }),
    );
  };

  /** Returns whether this process currently holds a live Pi agent for the session. */
  readonly hasLiveSession = (sessionId: string): boolean => this.#sessions.has(sessionId);

  #getOrCreate(
    connection: AgentSessionConnection<ConnectionData>,
  ): Effect.Effect<LiveAgentSession<ConnectionData>> {
    return Effect.suspend(() => {
      const existing = this.#sessions.get(connection.sessionId);
      if (existing !== undefined) {
        if (!sameOwner(existing.owner, connection.owner)) {
          return Effect.die(new Error("Session access denied"));
        }
        return Effect.succeed(existing);
      }
      const pending = this.#creating.get(connection.sessionId);
      if (pending !== undefined) return Effect.promise(() => pending);

      const creating = this.#create(connection).finally(() =>
        this.#creating.delete(connection.sessionId),
      );
      this.#creating.set(connection.sessionId, creating);
      return Effect.promise(() => creating);
    });
  }

  #create(
    connection: AgentSessionConnection<ConnectionData>,
  ): Promise<LiveAgentSession<ConnectionData>> {
    const host = this.#host;
    const factory = this.#factory;
    const sessions = this.#sessions;
    const onAgentEvent = (event: AgentEvent): Promise<void> =>
      this.#onAgentEvent(connection.sessionId, event);
    return Effect.runPromise(
      Effect.gen(function* () {
        const entries = yield* readSessionLog(host, agentSessionAddress(connection.sessionId));
        const dynamicContext: { current: AgentSessionDynamicContext } = {
          current: dynamicSessionContext(optionalPaywallId(connection.metadata?.paywallId), []),
        };
        const agent = yield* fromMaybePromise(() =>
          factory.create({
            sessionId: connection.sessionId,
            owner: connection.owner,
            connectionData: connection.data,
            messages: messagesFromSessionLog(entries),
            dynamicContext,
            metadata: connection.metadata,
          }),
        );
        const modelChange = entries.findLast(
          (entry): entry is Extract<SessionLogEntry, { readonly type: "model_change" }> =>
            entry.type === "model_change",
        );
        if (modelChange !== undefined) {
          const model = yield* fromMaybePromise(() =>
            factory.resolveModel(modelChange.provider, modelChange.modelId, connection.data),
          );
          if (model !== undefined) agent.state.model = model;
        }
        const unsubscribe = agent.subscribe(onAgentEvent);
        const live: LiveAgentSession<ConnectionData> = {
          agent,
          owner: connection.owner,
          connectionData: connection.data,
          dynamicContext,
          metadata: connection.metadata,
          unsubscribe,
        };
        sessions.set(connection.sessionId, live);
        return live;
      }),
    );
  }

  #onAgentEvent(sessionId: string, event: AgentEvent): Promise<void> {
    const host = this.#host;
    const index = this.#index;
    const sessions = this.#sessions;
    const broadcast = this.#broadcast(sessionId, {
      v: AGENT_PROTOCOL_VERSION,
      type: "event",
      event,
    });
    return Effect.runPromise(
      Effect.gen(function* () {
        yield* broadcast;
        const inputs: SessionLogEntryInput[] = [];
        if (event.type === "message_end" && event.message.role === "user") {
          inputs.push({ type: "message", message: event.message });
        }
        if (event.type === "turn_end") {
          inputs.push({ type: "message", message: event.message });
          inputs.push(
            ...event.toolResults.map(
              (message): SessionLogEntryInput => ({ type: "message", message }),
            ),
          );
        }
        if (inputs.length > 0) {
          yield* appendSessionLog(host, agentSessionAddress(sessionId), inputs);
        }
        if (event.type === "turn_end") {
          const live = sessions.get(sessionId);
          if (live !== undefined) {
            yield* touchIndex(index, {
              sessionId,
              owner: live.owner,
              metadata: live.metadata,
              connectionData: live.connectionData,
            });
          }
        }
      }),
    );
  }

  #ack(session: DurableEntitySession, command: AgentClientMessage): Effect.Effect<void> {
    return this.#send(session, {
      v: AGENT_PROTOCOL_VERSION,
      type: "ack",
      requestId: command.requestId,
      command: command.type,
    });
  }

  #send(session: DurableEntitySession, message: AgentServerMessage): Effect.Effect<void> {
    return session.send(encodeAgentServerMessage(message));
  }

  #broadcast(sessionId: string, message: AgentServerMessage): Effect.Effect<void> {
    return this.#host.run(agentSessionAddress(sessionId), (entity) =>
      entity.sessions.list.pipe(
        Effect.flatMap((sessions) =>
          Effect.forEach(sessions, (session) => this.#send(session, message), {
            discard: true,
            concurrency: "unbounded",
          }),
        ),
      ),
    );
  }

  #broadcastError(sessionId: string, requestId: string, message: string): Effect.Effect<void> {
    return this.#broadcast(sessionId, {
      v: AGENT_PROTOCOL_VERSION,
      type: "error",
      requestId,
      message,
    });
  }
}

/** Extracts structural session entries for API responses without mutable arrays. */
export const readonlySessionEntries = (
  entries: ReadonlyArray<SessionLogEntry>,
): ReadonlyArray<SessionLogEntry> => entries;
