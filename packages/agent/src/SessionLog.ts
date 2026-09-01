import type { AgentMessage } from "@earendil-works/pi-agent-core";
import type {
  DurableEntityAddress,
  DurableEntityContext,
  DurableEntityHostShape,
} from "@voidhash/platform/DurableEntity";
import * as Clock from "effect/Clock";
import * as Effect from "effect/Effect";
import { runtimeError, runSync } from "./RuntimeBoundary.ts";
import * as Schema from "effect/Schema";
import * as P from "effect/Predicate";
import * as Arr from "effect/Array";
import * as Option from "effect/Option";

const LOG_META_KEY = "agent-session/log/meta";
const LOG_ENTRY_PREFIX = "agent-session/log/entry/";
const OWNER_KEY = "agent-session/owner";

/** Maximum UTF-8 payload stored in one durable key-value value. */
export const SESSION_LOG_CHUNK_BYTES = 120 * 1024;

type SessionLogMeta = {
  readonly count: number;
} & Readonly<Partial<{ headId: string }>>;

interface StoredEntryMeta {
  readonly chunks: number;
}

const NullableString = Schema.NullOr(Schema.String);

interface SessionLogEntryBase {
  readonly id: string;
  readonly parentId: typeof NullableString.Type;
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
  now: () => runSync(Clock.currentTimeMillis),
};

const encodeJson = Schema.encodeSync(Schema.fromJsonString(Schema.Unknown));
const decodeJson = Schema.decodeUnknownSync(Schema.fromJsonString(Schema.Unknown));

const isRecord = (value: unknown): value is Record<string, unknown> =>
  P.isObject(value) && value !== null;

/**
 * Entity key-value storage is untyped, so a stored value is recognised as the
 * caller-owned shape it was written with rather than asserted at each call site.
 */
const isStoredValue = <Value>(value: unknown): value is Value => value !== undefined;

const isSessionLogEntry = (value: unknown): value is SessionLogEntry =>
  isRecord(value) && P.isString(value.id) && P.isString(value.type);

const entryPrefix = (index: number): string =>
  `${LOG_ENTRY_PREFIX}${index.toString().padStart(12, "0")}/`;

const entryMetaKey = (index: number): string => `${entryPrefix(index)}meta`;

const entryChunkKey = (index: number, chunk: number): string =>
  `${entryPrefix(index)}chunk/${chunk.toString().padStart(6, "0")}`;

const parseMeta = (value: unknown): SessionLogMeta => {
  if (!isRecord(value)) return { count: 0 };
  const count = value.count;
  if (!P.isNumber(count) || !Number.isSafeInteger(count) || count < 0) return { count: 0 };
  const headId = value.headId;
  if (P.isString(headId)) return { count, headId };
  return { count };
};

const parseEntryMeta = (value: unknown): Option.Option<StoredEntryMeta> => {
  if (!isRecord(value)) return Option.none();
  const chunks = value.chunks;
  if (!P.isNumber(chunks) || !Number.isSafeInteger(chunks) || chunks <= 0) return Option.none();
  return Option.some({ chunks });
};

const makeEntry = <Input extends SessionLogEntryInput>(
  input: Input,
  base: SessionLogEntryBase,
): Input & SessionLogEntryBase => ({ ...input, ...base });

const serializeEntry = (entry: SessionLogEntry): ReadonlyArray<string> => {
  const bytes = new TextEncoder().encode(encodeJson(entry));
  const decoder = new TextDecoder();
  const findChunkEnd = (end: number): number =>
    end < bytes.length && (bytes[end] & 0xc0) === 0x80 ? findChunkEnd(end - 1) : end;
  const readChunks = (offset: number, chunks: ReadonlyArray<string>): ReadonlyArray<string> => {
    if (offset >= bytes.length) return chunks;
    const end = findChunkEnd(Math.min(offset + SESSION_LOG_CHUNK_BYTES, bytes.length));
    return readChunks(end, [...chunks, decoder.decode(bytes.subarray(offset, end))]);
  };
  return readChunks(0, []);
};

const readEntry = (entity: DurableEntityContext, index: number) =>
  Effect.gen(function* () {
    const metaOption = parseEntryMeta(
      Option.getOrUndefined(yield* entity.keyValue.get(entryMetaKey(index))),
    );
    if (Option.isNone(metaOption)) {
      return yield* Effect.die(runtimeError(`Agent session log entry ${index} has invalid metadata`));
    }
    const meta = metaOption.value;
    const chunks = yield* Effect.forEach(
      Array.from({ length: meta.chunks }, (_, chunk) => chunk),
      (chunk) =>
        entity.keyValue
          .get(entryChunkKey(index, chunk))
          .pipe(Effect.map(Option.getOrUndefined)),
      { concurrency: 16 },
    );
    if (!chunks.every((chunk): chunk is string => P.isString(chunk))) {
      return yield* Effect.die(
        runtimeError(`Agent session log entry ${index} is missing a storage chunk`),
      );
    }
    const parsed = decodeJson(chunks.join(""));
    if (!isSessionLogEntry(parsed)) {
      return yield* Effect.die(runtimeError(`Agent session log entry ${index} is malformed`));
    }
    return parsed;
  });

const readEntries = (entity: DurableEntityContext) =>
  Effect.gen(function* () {
    const meta = parseMeta(Option.getOrUndefined(yield* entity.keyValue.get(LOG_META_KEY)));
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
    entity.keyValue.get(LOG_META_KEY).pipe(
      Effect.map((value) => parseMeta(Option.getOrUndefined(value)).count),
    ),
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
): Effect.Effect<ReadonlyArray<SessionLogEntry>> => {
  if (Arr.isReadonlyArrayEmpty(inputs)) return Effect.succeed([]);
  return host.run(address, (entity) =>
        Effect.gen(function* () {
          let meta = parseMeta(
            Option.getOrUndefined(yield* entity.keyValue.get(LOG_META_KEY)),
          );
          const appended: SessionLogEntry[] = [];

          yield* Effect.forEach(inputs, Effect.fn("iterate")(function* (input) {
            const entry = makeEntry(input, {
              id: options.id(),
              parentId: meta.headId ?? null,
              timestamp: options.now(),
            });
            const entryIndex = meta.count;
            const chunks = serializeEntry(entry);
            yield* Effect.forEach(
              chunks,
              (chunk, chunkIndex) =>
                entity.keyValue.put(entryChunkKey(entryIndex, chunkIndex), chunk),
              { concurrency: 1, discard: true },
            );
            yield* entity.keyValue.put(entryMetaKey(entryIndex), { chunks: chunks.length });
            appended.push(entry);
            meta = {
              count: meta.count + 1,
              headId: entry.id,
            };
          }), { concurrency: 1 });

          yield* entity.keyValue.put(LOG_META_KEY, meta);
          return appended;
        }),
  );
};

/** Loads the persisted session owner, if this session has been initialized. */
export const readSessionOwner = <Owner>(
  host: DurableEntityHostShape,
  address: DurableEntityAddress,
): Effect.Effect<Option.Option<Owner>> =>
  host.run(address, (entity) =>
    entity.keyValue.get(OWNER_KEY).pipe(
      Effect.map((value) => {
        if (Option.isSome(value) && isStoredValue<Owner>(value.value)) {
          return Option.some(value.value);
        }
        return Option.none();
      }),
    ),
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
      const existing = yield* entity.keyValue.get(OWNER_KEY);
      if (Option.isSome(existing) && isStoredValue<Owner>(existing.value)) {
        return equals(existing.value, owner);
      }
      yield* entity.keyValue.put(OWNER_KEY, owner);
      return true;
    }),
  );

/** Rehydrates the Pi message context from append-only session entries. */
export const messagesFromSessionLog = (
  entries: ReadonlyArray<SessionLogEntry>,
): ReadonlyArray<AgentMessage> =>
  entries.flatMap((entry) => {
    if (entry.type === "message") return [entry.message];
    return [];
  });
