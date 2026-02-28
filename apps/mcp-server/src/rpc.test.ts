import { afterEach, describe, expect, it, vi } from "vitest";

import { AppError } from "./errors";
import { ApiService } from "./api";

const makeService = () =>
  new ApiService({
    apiKey: "test-key",
    apiOrigin: "https://api.voidhash.test",
    apiUrl: "https://api.voidhash.test/api/v1",
    configPath: "/tmp/.voidhash",
    wsBaseUrl: "wss://api.voidhash.test/mimic/paywall-designer",
  });

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ApiService", () => {
  it("forwards paywall_create payload to API method", async () => {
    const service = makeService();
    const createPaywallMock = vi.fn().mockResolvedValue({ id: "pw_123" });

    (service as any).runCall = vi.fn(async (call: (apiClient: unknown) => Promise<unknown>) => {
      return call({
        paywalls: {
          createPaywall: createPaywallMock,
        },
      });
    });

    const result = await service.createPaywall({
      name: "Checkout Wall",
      projectId: "proj_1",
      slug: "checkout-wall",
    });

    expect(createPaywallMock).toHaveBeenCalledWith({
      payload: {
        name: "Checkout Wall",
        projectId: "proj_1",
        slug: "checkout-wall",
      },
    });
    expect(result).toEqual({ id: "pw_123" });
  });

  it("maps unknown API failures to API_ERROR with cause details", async () => {
    const service = makeService();

    await expect(
      (service as any).runCall(() => {
        throw new Error("upstream unavailable");
      }),
    ).rejects.toMatchObject({
      code: "API_ERROR",
      details: expect.objectContaining({
        apiUrl: "https://api.voidhash.test/api/v1",
        cause: expect.objectContaining({
          message: expect.stringContaining("upstream unavailable"),
          name: expect.stringContaining("Error"),
        }),
      }),
    } satisfies Partial<AppError>);
  });
});
