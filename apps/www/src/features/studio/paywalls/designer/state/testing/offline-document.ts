import {
  createClientDocument,
  type DocumentTransport,
  type ServerMessage,
  type TransactionEnvelope,
} from "@voidhash/mimic/client";
import type { Value } from "@voidhash/mimic-core";
import {
  createInitialPaywallDocumentInput,
  PaywallDesignerDocument,
} from "@voidhash/mimic-schema";
import { Effect } from "effect";

/**
 * Offline transport stub for engine-backed state tests: transactions apply
 * locally (optimistically) and are recorded, never acknowledged.
 */
export class StubTransport implements DocumentTransport {
  readonly submitted: TransactionEnvelope[] = [];

  async connect(): Promise<void> {}
  disconnect(): void {}
  subscribe(_handler: (message: ServerMessage) => void): () => void {
    return () => {};
  }
  subscribeConnection(_handler: (connected: boolean) => void): () => void {
    return () => {};
  }
  requestSnapshot(): void {}
  submit(transaction: TransactionEnvelope): void {
    this.submitted.push(transaction);
  }
  setPresence(_data: Value): void {}
  clearPresence(): void {}
  isConnected(): boolean {
    return false;
  }
}

/**
 * Creates an offline designer client document seeded with the initial
 * paywall content (one root containing one screen).
 */
export function createOfflineDesignerDocument() {
  return createClientDocument({
    initialValue: PaywallDesignerDocument.encode(createInitialPaywallDocumentInput()),
    primitive: PaywallDesignerDocument,
    transport: new StubTransport(),
  });
}

export type OfflineDesignerDocument = ReturnType<typeof createOfflineDesignerDocument>;

/**
 * Reads the seeded root and screen node ids from an offline document.
 */
export function seededIds(doc: OfflineDesignerDocument): { rootId: string; screenId: string } {
  const rootNode = doc.root.children.first();
  if (!rootNode) {
    return Effect.runSync(Effect.die(new Error("expected the seeded root node")));
  }
  const screen = rootNode.children.first();
  if (!screen) {
    return Effect.runSync(Effect.die(new Error("expected the seeded screen node")));
  }
  return { rootId: rootNode.id, screenId: screen.id };
}
