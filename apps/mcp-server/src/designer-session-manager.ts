import { ClientDocument, WebSocketTransport } from "@voidhash/mimic/client";
import { PaywallDesignerDocument, PresenceSchema } from "@voidhash/paywall-designer-schema";

import { ApiService } from "./api";
import { AppError, normalizeUnknownError } from "./errors";
import type { DesignerDocumentLike } from "./designer-ops";

export interface DesignerSessionInfo {
  connectedAt: string;
  paywallId: string;
}

interface ActiveDesignerSession {
  connectedAt: Date;
  document: DesignerDocumentLike & { disconnect: () => void };
  paywallId: string;
}

export class DesignerSessionManager {
  private activeSession: ActiveDesignerSession | null = null;

  constructor(
    private readonly apiService: ApiService,
    private readonly wsBaseUrl: string,
  ) {}

  getActiveSessionInfo(): DesignerSessionInfo | null {
    if (!this.activeSession) {
      return null;
    }

    return {
      connectedAt: this.activeSession.connectedAt.toISOString(),
      paywallId: this.activeSession.paywallId,
    };
  }

  async connect(paywallId: string): Promise<DesignerSessionInfo> {
    await this.disconnect();

    const editToken = await this.apiService.requestPaywallEditToken(paywallId);

    const document = ClientDocument.make({
      debug: false,
      initialPresence: {
        cursor: null,
        selectedNodeIds: [],
        user: {
          color: "#22c55e",
          name: "MCP Agent",
        },
      },
      presence: PresenceSchema,
      schema: PaywallDesignerDocument,
      transport: WebSocketTransport.make({
        authToken: editToken.token,
        documentId: paywallId,
        url: this.wsBaseUrl,
      }),
    });

    try {
      await document.connect();
    } catch (error) {
      throw new AppError("WS_ERROR", "Failed to connect to paywall designer websocket", {
        cause: normalizeUnknownError(error),
        paywallId,
        wsBaseUrl: this.wsBaseUrl,
      });
    }

    this.activeSession = {
      connectedAt: new Date(),
      document,
      paywallId,
    };

    return this.getActiveSessionInfo() as DesignerSessionInfo;
  }

  async disconnect(): Promise<DesignerSessionInfo | null> {
    if (!this.activeSession) {
      return null;
    }

    const previous = this.getActiveSessionInfo();

    try {
      this.activeSession.document.disconnect();
    } catch (error) {
      throw new AppError("WS_ERROR", "Failed to disconnect paywall designer websocket", {
        cause: normalizeUnknownError(error),
      });
    } finally {
      this.activeSession = null;
    }

    return previous;
  }

  getActiveDocument(): DesignerDocumentLike {
    if (!this.activeSession) {
      throw new AppError(
        "NO_ACTIVE_SESSION",
        "No active designer session. Call paywall_designer_connect first.",
      );
    }

    return this.activeSession.document;
  }
}
