import { VoidhashAnalyticsError } from "../../errors";
import type {
  AnalyticsBatchRequest,
  AnalyticsTransportResult,
} from "../analytics/contracts";

const DEFAULT_TIMEOUT_MS = 10_000;

export class AnalyticsHttpClient {
  constructor(
    private readonly baseUrl: string,
    private readonly publishableKey: string
  ) {}

  async send(
    distinctId: string,
    request: AnalyticsBatchRequest,
    options?: { keepalive?: boolean; timeoutMs?: number }
  ): Promise<AnalyticsTransportResult> {
    const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const controller =
      typeof AbortController !== "undefined" && !options?.keepalive
        ? new AbortController()
        : null;
    const timeoutId =
      controller && timeoutMs > 0
        ? setTimeout(() => controller.abort(), timeoutMs)
        : null;

    try {
      const response = await fetch(new URL("/v1/events", this.baseUrl), {
        body: JSON.stringify(request),
        headers: {
          "content-type": "application/json",
          "x-distinct-id": distinctId,
          "x-publishable-key": this.publishableKey,
        },
        keepalive: options?.keepalive ?? false,
        method: "POST",
        signal: controller?.signal,
      });
      let data: Record<string, unknown> | undefined;

      try {
        data = (await response.json()) as Record<string, unknown>;
      } catch {
        data = undefined;
      }

      return {
        data,
        status: response.status,
      };
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new VoidhashAnalyticsError("Analytics flush timed out.", {
          cause: error,
        });
      }

      throw new VoidhashAnalyticsError("Analytics request failed.", {
        cause: error,
      });
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  }
}
