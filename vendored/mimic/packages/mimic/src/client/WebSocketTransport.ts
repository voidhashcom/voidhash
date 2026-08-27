import type { Value } from "@voidhash/mimic-core";

import { NotConnectedError, ProtocolError, TransportError } from "./errors.js";
import type {
  AuthResultFailureMessage,
  AuthResultSuccessMessage,
  ClientMessage,
  ServerMessage,
  TransactionEnvelope,
} from "./protocol.js";
import type { DocumentTransport } from "./Transport.js";
import { resolveWebSocket } from "../shared/browser.js";

export interface WebSocketTransportOptions {
  readonly url: string;
  readonly token: string | (() => string | Promise<string>);
  readonly WebSocket?: typeof globalThis.WebSocket;
  readonly heartbeatMs?: number;
  readonly reconnect?: boolean;
  readonly reconnectDelayMs?: number;
  /**
   * Invoked on every authentication rejection by the server — on the initial
   * connect (in addition to the `connect()` promise rejecting) and on every
   * reconnect cycle, where no promise is pending to observe the failure.
   * Auth failure is terminal for this transport instance: it disconnects and
   * stops reconnecting. The consumer decides whether to retry by creating a
   * new transport (e.g. after refreshing the token).
   */
  readonly onAuthFailure?: (error: Error) => void;
}

const encodeClientMessage = (message: ClientMessage): string => JSON.stringify(message);

const decodeServerMessage = async (data: unknown): Promise<ServerMessage> => {
  if (typeof data === "string") {
    return JSON.parse(data) as ServerMessage;
  }
  if (data instanceof ArrayBuffer) {
    return JSON.parse(new TextDecoder().decode(data)) as ServerMessage;
  }
  if (ArrayBuffer.isView(data)) {
    return JSON.parse(new TextDecoder().decode(data)) as ServerMessage;
  }
  if (data instanceof Blob) {
    return JSON.parse(await data.text()) as ServerMessage;
  }
  throw new ProtocolError("Unsupported WebSocket message payload");
};

export class WebSocketTransport implements DocumentTransport {
  private readonly WebSocketImpl: typeof globalThis.WebSocket;
  private readonly messageHandlers = new Set<(message: ServerMessage) => void>();
  private readonly connectionHandlers = new Set<(connected: boolean) => void>();
  private socket: WebSocket | null = null;
  private connected = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  private heartbeatTimer: ReturnType<typeof setInterval> | undefined;
  private connectPromise: Promise<void> | null = null;
  private connectResolve: (() => void) | null = null;
  private connectReject: ((error: Error) => void) | null = null;
  private shouldReconnect = true;
  private lastPresence: Value | undefined;
  private pendingPresenceClear = false;

  constructor(private readonly options: WebSocketTransportOptions) {
    this.WebSocketImpl = resolveWebSocket(options.WebSocket);
  }

  connect(): Promise<void> {
    if (this.connected) {
      return Promise.resolve();
    }
    if (this.connectPromise) {
      return this.connectPromise;
    }

    this.shouldReconnect = this.options.reconnect ?? true;
    this.connectPromise = new Promise<void>((resolve, reject) => {
      this.connectResolve = resolve;
      this.connectReject = reject;
      this.openSocket();
    }).finally(() => {
      this.connectPromise = null;
    });

    return this.connectPromise;
  }

  disconnect(): void {
    this.shouldReconnect = false;
    this.clearReconnect();
    this.stopHeartbeat();
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    this.updateConnected(false);
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
    this.send({ type: "request_snapshot" });
  }

  submit(transaction: TransactionEnvelope): void {
    this.send({ type: "submit", transaction });
  }

  /**
   * Declares the local presence value. Never throws for connectivity reasons:
   * while disconnected (including the open-but-unauthenticated window and
   * reconnect gaps) the value is buffered and replayed after the next
   * successful authentication.
   */
  setPresence(data: Value): void {
    this.lastPresence = data;
    this.pendingPresenceClear = false;
    this.trySend({ type: "presence_set", data });
  }

  /**
   * Clears the local presence value. Never throws for connectivity reasons:
   * a clear that cannot be delivered is buffered and replayed after the next
   * successful authentication.
   */
  clearPresence(): void {
    this.lastPresence = undefined;
    this.pendingPresenceClear = !this.trySend({ type: "presence_clear" });
  }

  isConnected(): boolean {
    return this.connected;
  }

  private openSocket(): void {
    try {
      const socket = new this.WebSocketImpl(this.options.url);
      this.socket = socket;

      socket.addEventListener("open", () => {
        void this.resolveToken()
          .then((token) => {
            socket.send(
              encodeClientMessage({
                type: "auth",
                token,
              }),
            );
          })
          .catch((error) => {
            this.connectReject?.(error instanceof Error ? error : new Error(String(error)));
            this.connectResolve = null;
            this.connectReject = null;
            socket.close();
          });
      });

      socket.addEventListener("message", (event) => {
        void this.handleMessage(event.data);
      });

      socket.addEventListener("close", () => {
        this.stopHeartbeat();
        this.socket = null;
        this.updateConnected(false);
        if (this.connectReject) {
          this.connectReject(
            new TransportError("WebSocket closed before authentication completed"),
          );
          this.connectReject = null;
          this.connectResolve = null;
        }
        if (this.shouldReconnect) {
          this.scheduleReconnect();
        }
      });

      socket.addEventListener("error", () => {
        if (this.connectReject) {
          this.connectReject(new TransportError("WebSocket connection failed"));
          this.connectReject = null;
          this.connectResolve = null;
        }
      });
    } catch (error) {
      const transportError = error instanceof Error ? error : new Error(String(error));
      this.connectReject?.(transportError);
      this.connectReject = null;
      this.connectResolve = null;
      throw transportError;
    }
  }

  private async handleMessage(data: unknown): Promise<void> {
    const message = await decodeServerMessage(data);
    if (message.type === "auth_result") {
      if (message.success) {
        this.onAuthSuccess(message);
      } else {
        this.onAuthFailure(message);
      }
      return;
    }

    if (message.type === "pong") {
      return;
    }

    for (const handler of this.messageHandlers) {
      handler(message);
    }
  }

  private onAuthSuccess(_message: AuthResultSuccessMessage): void {
    this.updateConnected(true);
    this.startHeartbeat();
    this.connectResolve?.();
    this.connectResolve = null;
    this.connectReject = null;
    if (this.lastPresence !== undefined) {
      this.send({ type: "presence_set", data: this.lastPresence });
    } else if (this.pendingPresenceClear) {
      this.pendingPresenceClear = false;
      this.send({ type: "presence_clear" });
    }
  }

  private onAuthFailure(message: AuthResultFailureMessage): void {
    const error = new TransportError(`WebSocket authentication failed: ${message.error}`);
    this.options.onAuthFailure?.(error);
    this.connectReject?.(error);
    this.connectResolve = null;
    this.connectReject = null;
    this.disconnect();
  }

  private updateConnected(connected: boolean): void {
    this.connected = connected;
    for (const handler of this.connectionHandlers) {
      handler(connected);
    }
  }

  private send(message: ClientMessage): void {
    if (!this.trySend(message)) {
      throw new NotConnectedError();
    }
  }

  private trySend(message: ClientMessage): boolean {
    if (!this.socket || this.socket.readyState !== this.WebSocketImpl.OPEN || !this.connected) {
      return false;
    }
    this.socket.send(encodeClientMessage(message));
    return true;
  }

  private scheduleReconnect(): void {
    this.clearReconnect();
    this.reconnectTimer = setTimeout(() => {
      this.openSocket();
    }, this.options.reconnectDelayMs ?? 1000);
  }

  private clearReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.connected && this.socket?.readyState === this.WebSocketImpl.OPEN) {
        this.socket.send(encodeClientMessage({ type: "ping" }));
      }
    }, this.options.heartbeatMs ?? 30000);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = undefined;
    }
  }

  private async resolveToken(): Promise<string> {
    return typeof this.options.token === "function"
      ? await this.options.token()
      : this.options.token;
  }
}
