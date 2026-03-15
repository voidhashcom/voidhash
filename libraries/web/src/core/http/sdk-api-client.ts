import { VoidhashFeatureFlagsError, VoidhashIdentityError } from "../../errors";
import type { FeatureFlagsResult, VoidhashTraits } from "../../types";
import { BrowserPlatformProvider } from "../platform/browser-platform-provider";

type ApiClientRequest = {
  readonly headers: Record<string, string | undefined>;
  readonly payload?: Record<string, unknown>;
};

const trimUndefined = <TValue>(record: Record<string, TValue | undefined>) =>
  Object.fromEntries(
    Object.entries(record).filter(([, value]) => typeof value !== "undefined")
  ) as Record<string, TValue>;

export class SdkApiClient {
  constructor(
    private readonly baseUrl: string,
    private readonly publishableKey: string,
    private readonly observerMode: boolean,
    private readonly platform = new BrowserPlatformProvider()
  ) {}

  async destroy() {}

  async evaluateFeatureFlags(
    distinctId: string,
    flagKeys?: ReadonlyArray<string>
  ): Promise<FeatureFlagsResult> {
    try {
      return await this.request<FeatureFlagsResult>("/sdk/evaluate-flags", {
          headers: this.buildHeaders(distinctId),
          payload: trimUndefined({
            flagKeys,
          }),
        });
    } catch (error) {
      throw new VoidhashFeatureFlagsError("Failed to fetch feature flags.", {
        cause: error,
      });
    }
  }

  async identify(
    currentDistinctId: string,
    distinctId: string,
    traits?: VoidhashTraits
  ) {
    try {
      await this.request("/sdk/identify", {
          headers: this.buildHeaders(currentDistinctId),
          payload: trimUndefined({
            distinctId,
            traits: this.normalizeTraits(traits),
          }),
        });
    } catch (error) {
      throw new VoidhashIdentityError("Failed to identify distinct id.", {
        cause: error,
      });
    }
  }

  async syncTraits(distinctId: string, traits?: VoidhashTraits) {
    try {
      await this.request("/sdk/sync-customer-attributes", {
          headers: this.buildHeaders(distinctId),
          payload: trimUndefined({
            traits: this.normalizeTraits(traits),
          }),
        });
    } catch (error) {
      throw new VoidhashIdentityError("Failed to sync customer traits.", {
        cause: error,
      });
    }
  }

  private buildHeaders(distinctId: string) {
    return {
      ...this.platform.getSdkHeaders({
        observerMode: this.observerMode,
        publishableKey: this.publishableKey,
      }),
      "x-distinct-id": distinctId,
    };
  }

  private normalizeTraits(traits?: VoidhashTraits) {
    if (!traits || Object.keys(traits).length === 0) {
      return undefined;
    }

    return traits;
  }

  private async request<T = void>(path: string, input: ApiClientRequest) {
    const controller =
      typeof AbortController !== "undefined" ? new AbortController() : null;
    const timeoutId = controller
      ? setTimeout(() => controller.abort(), 10_000)
      : null;

    try {
      const response = await fetch(new URL(path, this.baseUrl), {
        body: input.payload ? JSON.stringify(input.payload) : undefined,
        headers: trimUndefined(input.headers),
        method: input.payload ? "POST" : "GET",
        signal: controller?.signal,
      });

      if (!response.ok) {
        throw new Error(`SDK request failed with status ${response.status}.`);
      }

      if (response.status === 204) {
        return undefined as T;
      }

      return (await response.json()) as T;
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  }
}
