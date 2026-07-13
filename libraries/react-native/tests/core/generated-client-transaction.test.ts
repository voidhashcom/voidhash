import { Effect } from "effect";
import { HttpClient, HttpClientRequest, HttpClientResponse } from "effect/unstable/http";
import { describe, expect, it } from "vitest";

import { make } from "@voidhash/generated-clients";

describe("generated SDK transaction client", () => {
  it("serializes the complete iOS correlation payload to the backend endpoint", async () => {
    let capturedRequest: Request | undefined;
    const httpClient = HttpClient.make((request) =>
      Effect.gen(function* () {
        capturedRequest = yield* HttpClientRequest.toWeb(request).pipe(Effect.orDie);
        return HttpClientResponse.fromWeb(
          request,
          new Response('{"accepted":true}', {
            headers: { "content-type": "application/json" },
            status: 200,
          }),
        );
      }),
    );
    const client = make(httpClient, {
      transformClient: (baseClient) =>
        Effect.succeed(
          baseClient.pipe(
            HttpClient.mapRequest((request) =>
              HttpClientRequest.prependUrl(request, "https://api.voidhash.test"),
            ),
          ),
        ),
    });

    const result = await Effect.runPromise(
      client.sdkSyncTransaction({
        params: {
          "x-client-bundle-id": "com.voidhash.test",
          "x-distinct-id": "user-123",
          "x-is-backgrounded": "false",
          "x-is-debug-build": "true",
          "x-observer-mode": "false",
          "x-platform": "ios",
          "x-platform-flavor": "native",
          "x-publishable-key": "pk_test",
          "x-sdk": "react-native",
          "x-sdk-version": "0.0.1",
        },
        payload: {
          appAccountToken: "3501e751-7582-58f9-9c1d-533c7466049f",
          platform: "ios",
          providerProductId: "com.voidhash.monthly.ios",
          productSlug: "monthly_sub",
          purchaseDate: 1_700_000_000_000,
          quantity: 1,
          receipt: "signed-transaction",
          transactionId: "transaction-1",
        },
      }),
    );

    expect(result).toEqual({ accepted: true });
    expect(capturedRequest?.url).toBe("https://api.voidhash.test/api/v1/sdk/sync-transaction");
    expect(await capturedRequest?.json()).toEqual({
      appAccountToken: "3501e751-7582-58f9-9c1d-533c7466049f",
      platform: "ios",
      providerProductId: "com.voidhash.monthly.ios",
      productSlug: "monthly_sub",
      purchaseDate: 1_700_000_000_000,
      quantity: 1,
      receipt: "signed-transaction",
      transactionId: "transaction-1",
    });
  });
});
