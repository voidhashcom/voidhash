import type { AgentMessage } from "@earendil-works/pi-agent-core";
import type {
  DurableEntityAddress,
  DurableEntityContext,
  DurableEntityHostShape,
} from "@voidhash/platform/DurableEntity";
import { Effect } from "effect";

const LOG_META_KEY = "agent-session/log/meta";
const LOG_ENTRY_PREFIX = "agent-session/log/entry/";
const OWNER_KEY = "agent-session/owner";

/** Maximum UTF-8 payload stored in one durable key-value value. */
export const SESSION_LOG_CHUNK_BYTES = 120 * 1024;

interface SessionLogMeta {
  readonly count: number;
  readonly headId?: string;
}

interface StoredEntryMeta {
  readonly chunks: number;
}

interface SessionLogEntryBase {
  readonly id: string;
  readonly parentId: string | null;
  readonly timestamp: number;
}

/** Append-only Pi-compatible transcript and structural entry. */
export type SessionLogEntry =
  | (SessionLogEntryBase & {
      readonly type: "message";
      readonly message: AgentMessage;
    })
  | (SessionLogEntryBase & {
      readonly type: "model_change";
      readonly provider: string;
      readonly modelId: string;
    })
  | (SessionLogEntryBase & {
      readonly type: "compaction";
      readonly summary: string;
      readonly firstKeptEntryId: string;
    })
  | (SessionLogEntryBase & {
      readonly type: "branch_summary";
      readonly summary: string;
      readonly fromEntryId: string;
    })
  | (SessionLogEntryBase & {
      readonly type: "label";
      readonly label: string;
    });

/** Entry data supplied before ids, parent links, and timestamps are assigned. */
export type SessionLogEntryInput =
  | { readonly type: "message"; readonly message: AgentMessage }
  | { readonly type: "model_change"; readonly provider: string; readonly modelId: string }
  | {
      readonly type: "compaction";
      readonly summary: string;
      readonly firstKeptEntryId: string;
    }
  | {
      readonly type: "branch_summary";
      readonly summary: string;
      readonly fromEntryId: string;
    }
  | { readonly type: "label"; readonly label: string };

/** Options for deterministic session-log tests. */
export interface SessionLogOptions {
  readonly id: () => string;
  readonly now: () => number;
}

const defaultOptions: SessionLogOptions = {
  id: () => globalThis.crypto.randomUUID(),
  now: Date.now,
};

const entryPrefix = (index: number): string =>
  `${LOG_ENTRY_PREFIX}${index.toString().padStart(12, "0")}/`;

const entryMetaKey = (index: number): string => `${entryPrefix(index)}meta`;

const entryChunkKey = (index: number, chunk: number): string =>
  `${entryPrefix(index)}chunk/${chunk.toString().padStart(6, "0")}`;

const parseMeta = (value: unknown): SessionLogMeta => {
  if (
    typeof value === "object" &&
    value !== null &&
    "count" in value &&
    typeof value.count === "number" &&
    Number.isSafeInteger(value.count) &&
    value.count >= 0
  ) {
    return value as SessionLogMeta;
  }
  return { count: 0 };
};

const parseEntryMeta = (value: unknown, index: number): StoredEntryMeta => {
  if (
    typeof value === "object" &&
    value !== null &&
    "chunks" in value &&
    typeof value.chunks === "number" &&
    Number.isSafeInteger(value.chunks) &&
    value.chunks > 0
  ) {
    return value as StoredEntryMeta;
  }
  throw new Error(`Agent session log entry ${index} has invalid metadata`);
};

const serializeEntry = (entry: SessionLogEntry): ReadonlyArray<string> => {
  const bytes = new TextEncoder().encode(JSON.stringify(entry));
  const decoder = new TextDecoder();
  const chunks: string[] = [];
  let offset = 0;
  while (offset < bytes.length) {
    let end = Math.min(offset + SESSION_LOG_CHUNK_BYTES, bytes.length);
    while (end < bytes.length && (bytes[end] & 0xc0) === 0x80) end -= 1;
    chunks.push(decoder.decode(bytes.subarray(offset, end)));
    offset = end;
  }
  return chunks;
};

const readEntry = (entity: DurableEntityContext, index: number) =>
  Effect.gen(function* () {
    const meta = parseEntryMeta(yield* entity.keyValue.get(entryMetaKey(index)), index);
    const chunks = yield* Effect.forEach(
      Array.from({ length: meta.chunks }, (_, chunk) => chunk),
      (chunk) => entity.keyValue.get(entryChunkKey(index, chunk)),
      { concurrency: 16 },
    );
    if (!chunks.every((chunk): chunk is string => typeof chunk === "string")) {
      return yield* Effect.die(
        new Error(`Agent session log entry ${index} is missing a storage chunk`),
      );
    }
    return JSON.parse(chunks.join("")) as SessionLogEntry;
  });

const readEntries = (entity: DurableEntityContext) =>
  Effect.gen(function* () {
    const meta = parseMeta(yield* entity.keyValue.get(LOG_META_KEY));
    return yield* Effect.forEach(
      Array.from({ length: meta.count }, (_, index) => index),
      (index) => readEntry(entity, index),
      { concurrency: 8 },
    );
  });

/** Reads every persisted session entry in append order. */
export const readSessionLog = (
  host: DurableEntityHostShape,
  address: DurableEntityAddress,
): Effect.Effect<ReadonlyArray<SessionLogEntry>> => host.run(address, readEntries);

/** Reads the persisted number of entries without loading transcript pages. */
export const readSessionLogCount = (
  host: DurableEntityHostShape,
  address: DurableEntityAddress,
): Effect.Effect<number> =>
  host.run(address, (entity) =>
    entity.keyValue.get(LOG_META_KEY).pipe(Effect.map((value) => parseMeta(value).count)),
  );

/**
 * Appends entries in one serialized entity transaction and links each entry to
 * the preceding head, preserving Pi's session-tree shape.
 */
export const appendSessionLog = (
  host: DurableEntityHostShape,
  address: DurableEntityAddress,
  inputs: ReadonlyArray<SessionLogEntryInput>,
  options: SessionLogOptions = defaultOptions,
): Effect.Effect<ReadonlyArray<SessionLogEntry>> =>
  inputs.length === 0
    ? Effect.succeed([])
    : host.run(address, (entity) =>
        Effect.gen(function* () {
          let meta = parseMeta(yield* entity.keyValue.get(LOG_META_KEY));
          const appended: SessionLogEntry[] = [];

          for (const input of inputs) {
            const entry = {
              ...input,
              id: options.id(),
              parentId: meta.headId ?? null,
              timestamp: options.now(),
            } as SessionLogEntry;
            const entryIndex = meta.count;
            const chunks = serializeEntry(entry);
            yield* Effect.forEach(
              chunks,
              (chunk, chunkIndex) =>
                entity.keyValue.put(entryChunkKey(entryIndex, chunkIndex), chunk),
              { discard: true },
            );
            yield* entity.keyValue.put(entryMetaKey(entryIndex), { chunks: chunks.length });
            appended.push(entry);
            meta = {
              count: meta.count + 1,
              headId: entry.id,
            };
          }

          yield* entity.keyValue.put(LOG_META_KEY, meta);
          return appended;
        }),
      );

/** Loads the persisted session owner, if this session has been initialized. */
export const readSessionOwner = <Owner>(
  host: DurableEntityHostShape,
  address: DurableEntityAddress,
): Effect.Effect<Owner | undefined> =>
  host.run(address, (entity) =>
    entity.keyValue.get(OWNER_KEY).pipe(Effect.map((value) => value as Owner | undefined)),
  );

/** Atomically initializes a session owner or verifies that it matches. */
export const ensureSessionOwner = <Owner>(
  host: DurableEntityHostShape,
  address: DurableEntityAddress,
  owner: Owner,
  equals: (left: Owner, right: Owner) => boolean,
): Effect.Effect<boolean> =>
  host.run(address, (entity) =>
    Effect.gen(function* () {
      const existing = (yield* entity.keyValue.get(OWNER_KEY)) as Owner | undefined;
      if (existing !== undefined) return equals(existing, owner);
      yield* entity.keyValue.put(OWNER_KEY, owner);
      return true;
    }),
  );

/** Rehydrates the Pi message context from append-only session entries. */
export const messagesFromSessionLog = (
  entries: ReadonlyArray<SessionLogEntry>,
): ReadonlyArray<AgentMessage> =>
  entries.flatMap((entry) => (entry.type === "message" ? [entry.message] : []));
