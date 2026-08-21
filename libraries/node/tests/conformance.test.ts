// oxlint-disable effect/noAsyncFunction, effect/noGlobals, effect/noNewError, effect/noTestLifecycleHooks, effect/noThrowStatement -- conformance runner tests drive a real HTTP server with vitest's async API and plain fetch on purpose: the SDK under test must be exercised exactly as application code would use it, not through an Effect test runtime.
import {
  API_PERSON_FIXTURE,
  API_PRODUCTS_FIXTURE,
  API_SECRET_KEY,
  DISTINCT_ID,
  HarnessClient,
  renderReport,
  SCHEMA_FIXTURE,
  startHarness,
  type HarnessHandle,
} from "@voidhash/sdk-test-harness";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createVoidhashSdk } from "../src/index";

/**
 * Conformance runner for @voidhash/node: executes the shared `api/core`
 * scenario suite against the harness server using the real SDK client and
 * verifies both the SDK's return values and the wire-level expectations.
 */
describe("node sdk conformance (api/core)", () => {
  let handle: HarnessHandle;
  let harness: HarnessClient;

  beforeAll(async () => {
    handle = await startHarness();
    harness = HarnessClient.forHandle(handle);
  });

  afterAll(async () => {
    await handle.shutdown();
  });

  it("executes the full api/core scenario in order", async () => {
    const session = await harness.createSession("api/core");
    const sdk = createVoidhashSdk({
      secretKey: API_SECRET_KEY,
      baseUrl: handle.url,
      headers: { "x-harness-session": session.sessionId },
    });

    expect(await sdk.schema.getSchema()).toEqual(SCHEMA_FIXTURE);
    expect(await sdk.products.listProducts()).toEqual(API_PRODUCTS_FIXTURE);

    expect(
      await sdk.persons.createPerson({
        payload: { distinctId: DISTINCT_ID, email: "user@example.com", name: "Conformance User" },
      }),
    ).toEqual(API_PERSON_FIXTURE);

    expect(
      await sdk.persons.getPersonByDistinctId({ params: { distinctId: DISTINCT_ID } }),
    ).toEqual(API_PERSON_FIXTURE);

    // Scripted 401: the SDK must surface the failure instead of returning junk.
    await expect(sdk.users.getUser()).rejects.toThrow();

    const report = await harness.completeSession(session.sessionId);
    expect(report.pass, renderReport(report)).toBe(true);
  });
});
