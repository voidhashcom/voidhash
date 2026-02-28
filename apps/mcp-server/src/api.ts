import { FetchHttpClient, HttpApiClient, HttpClient } from "@effect/platform";
import type {
  CreatePaywallBody,
  Paywall,
  PaywallEditToken,
  PaywallLocation,
} from "@voidhash/api-spec";
import { VoidhashV1Api } from "@voidhash/api-spec";
import { Effect } from "effect";

import type { VoidhashMcpConfig } from "./config";
import { AppError, normalizeUnknownError } from "./errors";
type CreatePaywallResponse = { id: string };

const withApiKey = (apiKey: string) =>
  HttpClient.mapRequestEffect((request) =>
    Effect.succeed({
      ...request,
      headers: {
        ...request.headers,
        "x-api-key": apiKey,
      },
    }),
  );

export class ApiService {
  constructor(private readonly config: VoidhashMcpConfig) {}

  private async runCall<T>(
    call: (apiClient: any) => Effect.Effect<T, unknown, unknown>,
  ): Promise<T> {
    const config = this.config;
    const effect = Effect.gen(function* runCall() {
      const apiClient = yield* HttpApiClient.make(VoidhashV1Api, {
        baseUrl: config.apiOrigin,
        transformClient: withApiKey(config.apiKey),
      });
      return yield* call(apiClient);
    }).pipe(Effect.provide(FetchHttpClient.layer)) as Effect.Effect<T, unknown, never>;

    try {
      return await Effect.runPromise(Effect.scoped(effect));
    } catch (error) {
      throw new AppError("API_ERROR", "Voidhash API request failed", {
        apiUrl: this.config.apiUrl,
        cause: normalizeUnknownError(error),
      });
    }
  }

  async listPaywalls(projectId: string): Promise<Paywall[]> {
    const result = await this.runCall((apiClient) =>
      apiClient.paywalls.listPaywallsByProjectId({ path: { projectId } }),
    );
    return result as Paywall[];
  }

  async createPaywall(input: CreatePaywallBody): Promise<CreatePaywallResponse> {
    const result = await this.runCall((apiClient) =>
      apiClient.paywalls.createPaywall({ payload: input }),
    );
    return result as CreatePaywallResponse;
  }

  async requestPaywallEditToken(paywallId: string): Promise<PaywallEditToken> {
    const result = await this.runCall((apiClient) =>
      apiClient.paywalls.requestPaywallEditToken({ path: { paywallId } }),
    );
    return result as PaywallEditToken;
  }

  async listPaywallLocations(): Promise<PaywallLocation[]> {
    const result = await this.runCall((apiClient) =>
      apiClient.paywall_locations.listPaywallLocations(),
    );
    return result as PaywallLocation[];
  }
}
