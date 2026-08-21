// oxlint-disable effect/noAsyncFunction, effect/noGlobals, effect/noNewError, effect/noTestLifecycleHooks, effect/noThrowStatement -- conformance runner tests drive a real HTTP server with vitest's async API and plain fetch on purpose: the SDK under test must be exercised exactly as application code would use it, not through an Effect test runtime.
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  HarnessClient,
  PUBLISHABLE_KEY,
  startHarness,
  type HarnessHandle,
} from "../src/index";

let handle: HarnessHandle;
let client: HarnessClient;

beforeAll(async () => {
  handle = await startHarness();
  client = HarnessClient.forHandle(handle);
});

afterAll(async () => {
  await handle.shutdown();
});

interface StepDescriptor {
  readonly id: string;
  readonly request: {
    readonly method: string;
    readonly path: string;
    readonly headers?: Record<string, string>;
    readonly requireHeaders?: ReadonlyArray<string>;
    readonly body?: unknown;
  };
}

const PLACEHOLDER_REQUIRE_HEADERS: ReadonlyArray<string> = [
  "x-client-bundle-id",
  "x-client-version",
  "x-nonce",
];

function replayHeaders(sessionId: string, stepDescriptor: StepDescriptor) {
  const headers: Record<string, string> = {
    ...stepDescriptor.request.headers,
    "x-harness-session": sessionId,
  };
  let requireHeaders = stepDescriptor.request.requireHeaders;
  if (requireHeaders === undefined) {
    requireHeaders = PLACEHOLDER_REQUIRE_HEADERS;
  }
  for (const header of requireHeaders) {
    headers[header] = `placeholder-${header}`;
  }
  if (stepDescriptor.request.body !== undefined) {
    headers["content-type"] = "application/json";
  }
  return headers;
}

function replayBody(stepDescriptor: StepDescriptor) {
  if (stepDescriptor.request.body === undefined) {
    return undefined;
  }
  return JSON.stringify(stepDescriptor.request.body);
}

/** Replays every step descriptor verbatim over raw fetch, like the native runners do. */
const replaySteps = async (
  sessionId: string,
  steps: ReadonlyArray<StepDescriptor>,
): Promise<Array<{ status: number; body: unknown }>> => {
  const results: Array<{ status: number; body: unknown }> = [];
  for (const stepDescriptor of steps) {
    const response = await fetch(`${handle.url}${stepDescriptor.request.path}`, {
      method: stepDescriptor.request.method,
      headers: replayHeaders(sessionId, stepDescriptor),
      body: replayBody(stepDescriptor),
    });
    results.push({ status: response.status, body: await response.json() });
  }
  return results;
};

describe("harness server", () => {
  it("reports health and registered suites", async () => {
    const health = await fetch(`${handle.url}/__harness/health`);
    expect(health.status).toBe(200);

    const suitesResponse = await fetch(`${handle.url}/__harness/suites`);
    const suites: { suites: Array<{ name: string }> } = await suitesResponse.json();
    expect(suites.suites.map((suite) => suite.name)).toContain("mobile/core");
  });

  it("passes a clean replay of mobile/core", async () => {
    const session = await client.createSession("mobile/core");
    expect(session.sessionId).toBeTruthy();
    expect(session.steps).toHaveLength(8);

    const steps: ReadonlyArray<StepDescriptor> = session.steps;
    const results = await replaySteps(session.sessionId, steps);
    expect(results[0]?.status).toBe(200);
    expect(results.at(-1)?.status).toBe(404);

    const report = await client.completeSession(session.sessionId);
    expect(report.suite).toBe("mobile/core");
    expect(report.totalSteps).toBe(8);
    expect(report.executedExchanges).toBe(8);
    if (!report.pass) throw new Error(`expected pass, got: ${JSON.stringify(report.violations)}`);
  });

  it("rejects a second concurrent session", async () => {
    const first = await client.createSession("api/core");
    await expect(client.createSession("api/core")).rejects.toThrow(/active-session-exists/);

    await client.completeSession(first.sessionId);
    const second = await client.createSession("api/core");
    expect(second.sessionId).not.toBe(first.sessionId);
    await client.completeSession(second.sessionId);
  });

  it("fails a session with wrong header values and reports diffs", async () => {
    const session = await client.createSession("mobile/core");

    await fetch(`${handle.url}${session.steps[0]?.request.path}`, {
      headers: {
        ...session.steps[0]?.request.headers,
        "x-publishable-key": "pk_wrong",
        "x-harness-session": session.sessionId,
      },
    });
    // Replay the rest correctly.
    for (const stepDescriptor of session.steps.slice(1)) {
      await fetch(`${handle.url}${stepDescriptor.request.path}`, {
        method: stepDescriptor.request.method,
        headers: replayHeaders(session.sessionId, stepDescriptor),
        body: replayBody(stepDescriptor),
      });
    }

    const report = await client.completeSession(session.sessionId);
    expect(report.pass).toBe(false);
    const headerViolation = report.violations.find(
      (violation) =>
        violation.kind === "header-mismatch" && violation.header === "x-publishable-key",
    );
    expect(headerViolation).toMatchObject({
      kind: "header-mismatch",
      expected: PUBLISHABLE_KEY,
      actual: "pk_wrong",
    });
  });

  it("fails a session when steps are skipped entirely", async () => {
    const session = await client.createSession("mobile/core");
    const report = await client.completeSession(session.sessionId);
    expect(report.pass).toBe(false);
    expect(report.violations.filter((violation) => violation.kind === "missing-step")).toHaveLength(
      8,
    );
  });

  it("flags unexpected requests after the suite is exhausted", async () => {
    const session = await client.createSession("test/retry");
    const path = session.steps[0]?.request.path ?? "";

    // The step has two scripted responses; a third request exhausts the suite.
    for (let index = 0; index < 3; index++) {
      await fetch(`${handle.url}${path}`, {
        headers: { "x-harness-session": session.sessionId },
      });
    }

    const report = await client.completeSession(session.sessionId);
    expect(
      report.violations.some((violation) => violation.kind === "unexpected-request"),
    ).toBe(true);
    expect(report.pass).toBe(false);
  });

  it("consumes multi-response retry steps in order and passes", async () => {
    const session = await client.createSession("test/retry");
    const path = session.steps[0]?.request.path ?? "";

    const first = await fetch(`${handle.url}${path}`, {
      headers: { "x-harness-session": session.sessionId },
    });
    expect(first.status).toBe(500);

    const second = await fetch(`${handle.url}${path}`, {
      headers: { "x-harness-session": session.sessionId },
    });
    expect(second.status).toBe(200);

    const report = await client.completeSession(session.sessionId);
    if (!report.pass) throw new Error(JSON.stringify(report.violations));
    expect(report.pass).toBe(true);
  });

  it("requires an x-harness-session header on playback routes", async () => {
    const response = await fetch(`${handle.url}/api/v1/sdk/schema`);
    expect(response.status).toBe(400);
  });

  it("404s unknown suites and unknown sessions", async () => {
    const unknownSuite = await fetch(`${handle.url}/__harness/sessions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ suite: "nope" }),
    });
    expect(unknownSuite.status).toBe(404);

    const unknownSession = await fetch(`${handle.url}/__harness/sessions/nope/complete`, {
      method: "POST",
    });
    expect(unknownSession.status).toBe(404);
  });
});
