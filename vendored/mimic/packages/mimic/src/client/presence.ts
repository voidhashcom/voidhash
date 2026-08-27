import {
  validate as validateSchema,
  validateValue,
  type Primitive,
  type Value,
} from "@voidhash/mimic-core";

import type { PresenceEntry, PresenceListener } from "./types.js";

export class PresenceManager<TPresence, TPresenceInput = TPresence> {
  private readonly listeners = new Set<PresenceListener>();
  private readonly entries = new Map<string, PresenceEntry<TPresence>>();
  private selfConnectionId: string | undefined;
  private selfValue: TPresence | undefined;
  private selfEncodedValue: Value | undefined;

  constructor(private readonly primitive: Primitive.Primitive<TPresenceInput, TPresence, any>) {}

  selfId(): string | undefined {
    return this.selfConnectionId;
  }

  self(): TPresence | undefined {
    if (this.selfConnectionId) {
      const entry = this.entries.get(this.selfConnectionId);
      if (entry !== undefined) {
        return entry.data;
      }
    }
    return this.selfValue;
  }

  others(): ReadonlyMap<string, PresenceEntry<TPresence>> {
    const result = new Map<string, PresenceEntry<TPresence>>();
    for (const [id, entry] of this.entries) {
      if (id !== this.selfConnectionId) {
        result.set(id, entry);
      }
    }
    return result;
  }

  all(): ReadonlyMap<string, PresenceEntry<TPresence>> {
    return new Map(this.entries);
  }

  subscribe(listener: PresenceListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Records a local presence write and echoes it into the live entries map
   * immediately (when the connection id is known), so `self()` and presence
   * subscribers reflect the write synchronously instead of waiting for the
   * server to echo the broadcast back.
   */
  encode(data: TPresenceInput): Value {
    const encoded = this.sanitize(this.primitive.encode(data));
    const decoded = this.primitive.decode(encoded);
    this.selfValue = decoded;
    this.selfEncodedValue = encoded;
    if (decoded !== undefined && this.selfConnectionId !== undefined) {
      this.entries.set(this.selfConnectionId, {
        data: decoded,
        userId: this.entries.get(this.selfConnectionId)?.userId,
      });
    }
    this.emit();
    return encoded;
  }

  clearLocal(): void {
    this.selfValue = undefined;
    this.selfEncodedValue = undefined;
    if (this.selfConnectionId !== undefined) {
      this.entries.delete(this.selfConnectionId);
    }
    this.emit();
  }

  storedEncodedValue(): Value | undefined {
    return this.selfEncodedValue;
  }

  applySnapshot(
    selfId: string,
    presences: Record<string, { readonly data: Value; readonly userId?: string }>,
  ): void {
    this.selfConnectionId = selfId;
    this.entries.clear();
    for (const [id, entry] of Object.entries(presences)) {
      const decoded = this.decode(entry.data);
      if (decoded !== undefined) {
        this.entries.set(id, {
          data: decoded,
          userId: entry.userId,
        });
      }
    }
    // The local value is authoritative for self: the snapshot may lag local
    // writes (or, on a fresh connection id, not contain self at all).
    if (this.selfValue !== undefined) {
      this.entries.set(selfId, {
        data: this.selfValue,
        userId: this.entries.get(selfId)?.userId,
      });
    } else {
      this.entries.delete(selfId);
    }
    this.emit();
  }

  applyUpdate(id: string, data: Value, userId?: string): void {
    if (id === this.selfConnectionId) {
      // Server echo of a local write: local state is authoritative and may
      // already be ahead of the echo — only adopt the userId enrichment.
      const existing = this.entries.get(id);
      if (existing !== undefined && userId !== undefined && existing.userId !== userId) {
        this.entries.set(id, { data: existing.data, userId });
        this.emit();
      }
      return;
    }
    const decoded = this.decode(data);
    if (decoded === undefined) {
      return;
    }
    this.entries.set(id, { data: decoded, userId });
    this.emit();
  }

  applyRemove(id: string): void {
    if (id === this.selfConnectionId && this.selfEncodedValue !== undefined) {
      // Stale echo of an earlier clear that a newer local set has overtaken.
      return;
    }
    this.entries.delete(id);
    this.emit();
  }

  resetConnectionState(): void {
    this.selfConnectionId = undefined;
    this.entries.clear();
    this.emit();
  }

  private decode(data: Value): TPresence | undefined {
    try {
      const sanitized = this.sanitize(data);
      return this.primitive.decode(sanitized);
    } catch {
      return undefined;
    }
  }

  private sanitize(data: Value): Value {
    validateValue(data);
    const sanitized = validateSchema(this.primitive.schema, data);
    if (sanitized === undefined) {
      throw new Error("Presence schema sanitized to undefined");
    }
    return sanitized;
  }

  private emit(): void {
    for (const listener of this.listeners) {
      listener.onPresenceChange?.();
    }
  }
}
