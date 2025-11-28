/**
 * Yjs sync and awareness protocol encoding/decoding.
 * Ported from y-redis protocol.js
 *
 * @since 1.0.0
 */
/** biome-ignore-all lint/nursery/noBitwiseOperators: <explanation> */

import * as awarenessProtocol from 'y-protocols/awareness';
import * as Y from 'yjs';

// --- Message Type Constants ---

/**
 * Sync message type
 * @since 1.0.0
 */
export const MESSAGE_SYNC = 0 as const;

/**
 * Awareness message type
 * @since 1.0.0
 */
export const MESSAGE_AWARENESS = 1 as const;

/**
 * Auth message type
 * @since 1.0.0
 */
export const MESSAGE_AUTH = 2 as const;

/**
 * Query awareness message type
 * @since 1.0.0
 */
export const MESSAGE_QUERY_AWARENESS = 3 as const;

// --- Sync Sub-Message Types ---

/**
 * Sync step 1 - send state vector
 * @since 1.0.0
 */
export const MESSAGE_SYNC_STEP1 = 0 as const;

/**
 * Sync step 2 - send document diff
 * @since 1.0.0
 */
export const MESSAGE_SYNC_STEP2 = 1 as const;

/**
 * Sync update message
 * @since 1.0.0
 */
export const MESSAGE_SYNC_UPDATE = 2 as const;

// --- Binary Encoding Utilities ---

/**
 * Encode a variable-length unsigned integer
 */
const writeVarUint = (bytes: number[], num: number): void => {
  let n = num;
  while (n > 127) {
    bytes.push((num & 127) | 128);
    n = Math.floor(num / 128);
  }
  bytes.push(n);
};

/**
 * Read a variable-length unsigned integer from a Uint8Array
 */
const readVarUint = (data: Uint8Array, offset: { value: number }): number => {
  let num = 0;
  let mult = 1;
  while (offset.value < data.length) {
    const byte = data.at(offset.value);
    offset.value++;
    if (byte === undefined) {
      break;
    }
    num += (byte & 127) * mult;
    if (byte < 128) {
      break;
    }
    mult *= 128;
  }
  return num;
};

/**
 * Encode a Uint8Array with its length prefix
 */
const writeVarUint8Array = (bytes: number[], arr: Uint8Array): void => {
  writeVarUint(bytes, arr.length);
  for (const byte of arr) {
    bytes.push(byte);
  }
};

/**
 * Read a variable-length Uint8Array from data
 */
const readVarUint8Array = (
  data: Uint8Array,
  offset: { value: number }
): Uint8Array => {
  const len = readVarUint(data, offset);
  const arr = data.subarray(offset.value, offset.value + len);
  offset.value += len;
  return arr;
};

// --- Protocol Encoding Functions ---

/**
 * Encode sync step 1 message (state vector request)
 *
 * @since 1.0.0
 */
export const encodeSyncStep1 = (stateVector: Uint8Array): Uint8Array => {
  const bytes: number[] = [];
  writeVarUint(bytes, MESSAGE_SYNC);
  writeVarUint(bytes, MESSAGE_SYNC_STEP1);
  writeVarUint8Array(bytes, stateVector);
  return new Uint8Array(bytes);
};

/**
 * Encode sync step 2 message (document diff)
 *
 * @since 1.0.0
 */
export const encodeSyncStep2 = (diff: Uint8Array): Uint8Array => {
  const bytes: number[] = [];
  writeVarUint(bytes, MESSAGE_SYNC);
  writeVarUint(bytes, MESSAGE_SYNC_STEP2);
  writeVarUint8Array(bytes, diff);
  return new Uint8Array(bytes);
};

/**
 * Encode a sync update message
 *
 * @since 1.0.0
 */
export const encodeSyncUpdate = (update: Uint8Array): Uint8Array => {
  const bytes: number[] = [];
  writeVarUint(bytes, MESSAGE_SYNC);
  writeVarUint(bytes, MESSAGE_SYNC_UPDATE);
  writeVarUint8Array(bytes, update);
  return new Uint8Array(bytes);
};

/**
 * Encode an awareness update message
 *
 * @since 1.0.0
 */
export const encodeAwarenessUpdate = (
  awareness: awarenessProtocol.Awareness,
  clients: readonly number[]
): Uint8Array => {
  const bytes: number[] = [];
  writeVarUint(bytes, MESSAGE_AWARENESS);
  const awarenessUpdate = awarenessProtocol.encodeAwarenessUpdate(
    awareness,
    clients as number[]
  );
  writeVarUint8Array(bytes, awarenessUpdate);
  return new Uint8Array(bytes);
};

/**
 * Encode awareness user disconnected message
 *
 * @since 1.0.0
 */
export const encodeAwarenessUserDisconnected = (
  clientId: number,
  lastClock: number
): Uint8Array => {
  const bytes: number[] = [];
  writeVarUint(bytes, MESSAGE_AWARENESS);

  // Create inner awareness update
  const innerBytes: number[] = [];
  writeVarUint(innerBytes, 1); // one change
  writeVarUint(innerBytes, clientId);
  writeVarUint(innerBytes, lastClock + 1);
  // Write null state as JSON string
  const nullStr = JSON.stringify(null);
  writeVarUint(innerBytes, nullStr.length);
  for (let i = 0; i < nullStr.length; i++) {
    innerBytes.push(nullStr.charCodeAt(i));
  }

  writeVarUint8Array(bytes, new Uint8Array(innerBytes));
  return new Uint8Array(bytes);
};

// --- Message Parsing ---

/**
 * Parsed message result
 */
export type ParsedMessage =
  | {
      readonly type: 'sync';
      readonly syncType: 'step1';
      readonly stateVector: Uint8Array;
    }
  | {
      readonly type: 'sync';
      readonly syncType: 'step2';
      readonly diff: Uint8Array;
    }
  | {
      readonly type: 'sync';
      readonly syncType: 'update';
      readonly update: Uint8Array;
    }
  | { readonly type: 'awareness'; readonly update: Uint8Array }
  | { readonly type: 'unknown'; readonly messageType: number };

/**
 * Parse a protocol message
 *
 * @since 1.0.0
 */
export const parseMessage = (data: Uint8Array): ParsedMessage => {
  const offset = { value: 0 };
  const messageType = readVarUint(data, offset);

  if (messageType === MESSAGE_SYNC) {
    const syncType = readVarUint(data, offset);
    const payload = readVarUint8Array(data, offset);

    if (syncType === MESSAGE_SYNC_STEP1) {
      return { type: 'sync', syncType: 'step1', stateVector: payload };
    }
    if (syncType === MESSAGE_SYNC_STEP2) {
      return { type: 'sync', syncType: 'step2', diff: payload };
    }
    if (syncType === MESSAGE_SYNC_UPDATE) {
      return { type: 'sync', syncType: 'update', update: payload };
    }
  } else if (messageType === MESSAGE_AWARENESS) {
    const update = readVarUint8Array(data, offset);
    return { type: 'awareness', update };
  }

  return { type: 'unknown', messageType };
};

// --- Message Merging ---

/**
 * Merge multiple protocol messages for efficient transmission.
 * Combines sync updates and awareness states.
 *
 * @since 1.0.0
 */
export const mergeMessages = (
  messages: readonly Uint8Array[]
): readonly Uint8Array[] => {
  if (messages.length < 2) {
    return messages;
  }

  const awareness = new awarenessProtocol.Awareness(new Y.Doc());
  const updates: Uint8Array[] = [];

  for (const msg of messages) {
    const parsed = parseMessage(msg);

    if (parsed.type === 'sync' && parsed.syncType === 'update') {
      updates.push(parsed.update);
    } else if (parsed.type === 'awareness') {
      awarenessProtocol.applyAwarenessUpdate(awareness, parsed.update, null);
    }
  }

  const result: Uint8Array[] = [];

  if (updates.length > 0) {
    result.push(encodeSyncUpdate(Y.mergeUpdates(updates)));
  }

  const awarenessStates = awareness.getStates();
  if (awarenessStates.size > 0) {
    result.push(encodeAwarenessUpdate(awareness, [...awarenessStates.keys()]));
  }

  return result;
};

/**
 * Check if a message is a sync step 2 or update (for filtering)
 *
 * @since 1.0.0
 */
export const isSyncUpdate = (data: Uint8Array): boolean => {
  if (data.length < 2) {
    return false;
  }
  const offset = { value: 0 };
  const msgType = readVarUint(data, offset);
  if (msgType !== MESSAGE_SYNC) {
    return false;
  }
  const syncType = readVarUint(data, offset);
  return syncType === MESSAGE_SYNC_STEP2 || syncType === MESSAGE_SYNC_UPDATE;
};

/**
 * Check if a message is an awareness update
 *
 * @since 1.0.0
 */
export const isAwarenessUpdate = (data: Uint8Array): boolean => {
  if (data.length < 1) {
    return false;
  }
  const offset = { value: 0 };
  const msgType = readVarUint(data, offset);
  return msgType === MESSAGE_AWARENESS;
};

/**
 * Convert sync step 2 to sync update for redistribution
 *
 * @since 1.0.0
 */
export const convertSyncStep2ToUpdate = (
  data: Uint8Array
): Uint8Array | null => {
  if (data.length < 4) {
    return null;
  }

  const offset = { value: 0 };
  const msgType = readVarUint(data, offset);
  if (msgType !== MESSAGE_SYNC) {
    return null;
  }

  const syncType = readVarUint(data, offset);
  if (syncType !== MESSAGE_SYNC_STEP2) {
    return null;
  }

  const payload = readVarUint8Array(data, offset);
  return encodeSyncUpdate(payload);
};
