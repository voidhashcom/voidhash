import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  clientDocumentMakeMock,
  webSocketTransportMakeMock,
} = vi.hoisted(() => ({
  clientDocumentMakeMock: vi.fn(),
  webSocketTransportMakeMock: vi.fn(),
}));

vi.mock("@voidhash/mimic/client", () => ({
  ClientDocument: {
    make: clientDocumentMakeMock,
  },
  WebSocketTransport: {
    make: webSocketTransportMakeMock,
  },
}));

import { AppError } from "./errors";
import { DesignerSessionManager } from "./designer-session-manager";

type MockDocument = {
  connect: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
  root: Record<string, unknown>;
  transaction: ReturnType<typeof vi.fn>;
};

const makeMockDocument = (): MockDocument => ({
  connect: vi.fn().mockResolvedValue(undefined),
  disconnect: vi.fn(),
  root: {},
  transaction: vi.fn(),
});

describe("DesignerSessionManager", () => {
  beforeEach(() => {
    clientDocumentMakeMock.mockReset();
    webSocketTransportMakeMock.mockReset();
  });

  it("connects and stores active session", async () => {
    const rpcService = {
      requestPaywallEditToken: vi.fn().mockResolvedValue({
        expiresAt: new Date(),
        token: "edit-token",
      }),
    };
    const document = makeMockDocument();

    webSocketTransportMakeMock.mockReturnValue({ transport: "ok" });
    clientDocumentMakeMock.mockReturnValue(document);

    const manager = new DesignerSessionManager(rpcService as any, "wss://api.voidhash.test/mimic/paywall-designer");
    const session = await manager.connect("pw_1");

    expect(session.paywallId).toBe("pw_1");
    expect(rpcService.requestPaywallEditToken).toHaveBeenCalledWith("pw_1");
    expect(webSocketTransportMakeMock).toHaveBeenCalledWith({
      authToken: "edit-token",
      documentId: "pw_1",
      url: "wss://api.voidhash.test/mimic/paywall-designer",
    });
    expect(document.connect).toHaveBeenCalledTimes(1);
    expect(manager.getActiveDocument()).toBe(document);
  });

  it("replaces existing active session on second connect", async () => {
    const rpcService = {
      requestPaywallEditToken: vi
        .fn()
        .mockResolvedValueOnce({ expiresAt: new Date(), token: "token-1" })
        .mockResolvedValueOnce({ expiresAt: new Date(), token: "token-2" }),
    };
    const firstDocument = makeMockDocument();
    const secondDocument = makeMockDocument();

    webSocketTransportMakeMock.mockReturnValue({ transport: "ok" });
    clientDocumentMakeMock
      .mockReturnValueOnce(firstDocument)
      .mockReturnValueOnce(secondDocument);

    const manager = new DesignerSessionManager(rpcService as any, "wss://api.voidhash.test/mimic/paywall-designer");

    await manager.connect("pw_1");
    await manager.connect("pw_2");

    expect(firstDocument.disconnect).toHaveBeenCalledTimes(1);
    expect(secondDocument.connect).toHaveBeenCalledTimes(1);
    expect(manager.getActiveSessionInfo()?.paywallId).toBe("pw_2");
  });

  it("disconnect clears active session", async () => {
    const rpcService = {
      requestPaywallEditToken: vi.fn().mockResolvedValue({
        expiresAt: new Date(),
        token: "edit-token",
      }),
    };
    const document = makeMockDocument();

    webSocketTransportMakeMock.mockReturnValue({ transport: "ok" });
    clientDocumentMakeMock.mockReturnValue(document);

    const manager = new DesignerSessionManager(rpcService as any, "wss://api.voidhash.test/mimic/paywall-designer");
    await manager.connect("pw_1");

    const disconnected = await manager.disconnect();
    expect(disconnected?.paywallId).toBe("pw_1");
    expect(document.disconnect).toHaveBeenCalledTimes(1);

    expect(() => manager.getActiveDocument()).toThrowError(AppError);
    expect(() => manager.getActiveDocument()).toThrowError(
      /No active designer session/,
    );
  });

  it("throws NO_ACTIVE_SESSION when accessing active document without connect", () => {
    const manager = new DesignerSessionManager(
      { requestPaywallEditToken: vi.fn() } as any,
      "wss://api.voidhash.test/mimic/paywall-designer",
    );

    try {
      manager.getActiveDocument();
      throw new Error("Expected getActiveDocument to throw");
    } catch (error) {
      expect(error).toMatchObject({
        code: "NO_ACTIVE_SESSION",
      } satisfies Partial<AppError>);
    }
  });
});
