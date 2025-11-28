/**
 * Storage service for persisting Yjs documents.
 * Provides an abstract interface that can be implemented with different backends
 * (memory, PostgreSQL, S3, etc.)
 *
 * @since 1.0.0
 */

import * as Arr from 'effect/Array';
import * as Context from 'effect/Context';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as Ref from 'effect/Ref';
import * as Y from 'yjs';

/**
 * Result of retrieving a document from storage.
 * Contains the merged document data and references to individual stored versions.
 *
 * @since 1.0.0
 */
export interface RetrieveDocResult {
  readonly doc: Uint8Array;
  readonly references: readonly string[];
}

/**
 * Storage service interface for persisting Yjs documents.
 *
 * @since 1.0.0
 */
export interface Storage {
  /**
   * Persist a Yjs document to storage.
   * Each call creates a new reference that can be merged with existing versions.
   */
  readonly persistDoc: (
    room: string,
    docname: string,
    ydoc: Y.Doc
  ) => Effect.Effect<void>;

  /**
   * Retrieve a document from storage.
   * Returns the merged document data and all stored references.
   * Returns null if no document exists.
   */
  readonly retrieveDoc: (
    room: string,
    docname: string
  ) => Effect.Effect<RetrieveDocResult | null>;

  /**
   * Retrieve only the state vector of a document.
   * More efficient than retrieving the full document when only
   * sync state is needed.
   */
  readonly retrieveStateVector: (
    room: string,
    docname: string
  ) => Effect.Effect<Uint8Array | null>;

  /**
   * Delete specific references from storage.
   * Used for cleanup after merging document versions.
   */
  readonly deleteReferences: (
    room: string,
    docname: string,
    references: readonly string[]
  ) => Effect.Effect<void>;
}

/**
 * Storage service tag.
 *
 * @since 1.0.0
 */
export class StorageService extends Context.Tag('@yjs-effect/Storage')<
  StorageService,
  Storage
>() {}

// --- Memory Storage Implementation ---

/**
 * Internal state for memory storage.
 * Structure: Map<room, Map<docname, Map<referenceId, Uint8Array>>>
 */
type MemoryStorageState = Map<string, Map<string, Map<string, Uint8Array>>>;

/**
 * Generate a UUID v4 for reference IDs.
 */
const generateUuid = (): string => {
  return crypto.randomUUID();
};

/**
 * Create a memory-based storage implementation.
 * Useful for testing and single-server deployments.
 *
 * @since 1.0.0
 */
export const makeMemoryStorage = Effect.gen(function* () {
  const stateRef = yield* Ref.make<MemoryStorageState>(new Map());

  const getOrCreateRoom = (
    state: MemoryStorageState,
    room: string
  ): Map<string, Map<string, Uint8Array>> => {
    let roomMap = state.get(room);
    if (!roomMap) {
      roomMap = new Map();
      state.set(room, roomMap);
    }
    return roomMap;
  };

  const getOrCreateDoc = (
    roomMap: Map<string, Map<string, Uint8Array>>,
    docname: string
  ): Map<string, Uint8Array> => {
    let docMap = roomMap.get(docname);
    if (!docMap) {
      docMap = new Map();
      roomMap.set(docname, docMap);
    }
    return docMap;
  };

  const persistDoc: Storage['persistDoc'] = (room, docname, ydoc) =>
    Ref.update(stateRef, (state) => {
      const roomMap = getOrCreateRoom(state, room);
      const docMap = getOrCreateDoc(roomMap, docname);
      const referenceId = generateUuid();
      docMap.set(referenceId, Y.encodeStateAsUpdateV2(ydoc));
      return state;
    });

  const retrieveDoc: Storage['retrieveDoc'] = (room, docname) =>
    Ref.get(stateRef).pipe(
      Effect.map((state) => {
        const refs = state.get(room)?.get(docname);
        if (!refs || refs.size === 0) {
          return null;
        }
        const updates = Arr.fromIterable(refs.values());
        const references = Arr.fromIterable(refs.keys());
        return {
          doc: Y.mergeUpdatesV2(updates),
          references
        };
      })
    );

  const retrieveStateVector: Storage['retrieveStateVector'] = (room, docname) =>
    retrieveDoc(room, docname).pipe(
      Effect.map((result) =>
        result ? Y.encodeStateVectorFromUpdateV2(result.doc) : null
      )
    );

  const deleteReferences: Storage['deleteReferences'] = (
    room,
    docname,
    references
  ) =>
    Ref.update(stateRef, (state) => {
      const docMap = state.get(room)?.get(docname);
      if (docMap) {
        for (const ref of references) {
          docMap.delete(ref);
        }
      }
      return state;
    });

  return {
    persistDoc,
    retrieveDoc,
    retrieveStateVector,
    deleteReferences
  } satisfies Storage;
});

/**
 * Layer providing a memory-based storage implementation.
 *
 * @since 1.0.0
 */
export const MemoryStorageLive: Layer.Layer<StorageService> = Layer.effect(
  StorageService,
  makeMemoryStorage
);
