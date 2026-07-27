import {
  Primitive,
  booleanValue,
  objectValue,
  stringValue,
  type Value,
} from "@voidhash/mimic-core";

import type { ServerMessage, TransactionEnvelope } from "../src/client/protocol.js";
import type { DocumentTransport } from "../src/client/Transport.js";

export const TestPrimitive = Primitive.Struct({
  title: Primitive.String().required(),
  done: Primitive.Boolean().default(false),
}).required();

export const TestPresencePrimitive = Primitive.Struct({
  name: Primitive.String(),
}).required();

export const makePresenceValue = (name: string): Value =>
  objectValue({
    name: stringValue(name),
  });

export const makeValue = (title: string, done?: boolean, extra?: Record<string, Value>): Value =>
  objectValue({
    title: stringValue(title),
    ...(done !== undefined ? { done: booleanValue(done) } : {}),
    ...extra,
  });

export class FakeTransport implements DocumentTransport {
  readonly submitted: TransactionEnvelope[] = [];
  readonly connectionHandlers = new Set<(connected: boolean) => void>();
  readonly messageHandlers = new Set<(message: ServerMessage) => void>();
  readonly presenceValues: Value[] = [];
  readonly snapshotRequests: number[] = [];
  connected = false;

  async connect(): Promise<void> {
    this.connected = true;
    this.emitConnection(true);
  }

  disconnect(): void {
    this.connected = false;
    this.emitConnection(false);
  }

  subscribe(handler: (message: ServerMessage) => void): () => void {
    this.messageHandlers.add(handler);
    return () => {
      this.messageHandlers.delete(handler);
    };
  }

  subscribeConnection(handler: (connected: boolean) => void): () => void {
    this.connectionHandlers.add(handler);
    return () => {
      this.connectionHandlers.delete(handler);
    };
  }

  requestSnapshot(): void {
    this.snapshotRequests.push(Date.now());
  }

  submit(transaction: TransactionEnvelope): void {
    this.submitted.push(transaction);
  }

  setPresence(data: Value): void {
    this.presenceValues.push(data);
  }

  clearPresence(): void {
    this.presenceValues.push(undefined);
  }

  isConnected(): boolean {
    return this.connected;
  }

  emit(message: ServerMessage): void {
    for (const handler of this.messageHandlers) {
      handler(message);
    }
  }

  emitConnection(connected: boolean): void {
    this.connected = connected;
    for (const handler of this.connectionHandlers) {
      handler(connected);
    }
  }
}
