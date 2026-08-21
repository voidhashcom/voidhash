// oxlint-disable effect/noAsyncFunction, effect/noGlobals, effect/noNewError, effect/noTestLifecycleHooks, effect/noThrowStatement -- conformance runner tests drive a real HTTP server with vitest's async API and plain fetch on purpose: the SDK under test must be exercised exactly as application code would use it, not through an Effect test runtime.
import { describe, expect, it } from "vitest";

import { matchRequest, type ActualRequest } from "../src/server/verify";
import { step } from "../src/types";

const actual = (overrides: Partial<ActualRequest> = {}): ActualRequest => ({
  method: "GET",
  path: "/api/v1/example",
  headers: {},
  contentType: undefined,
  body: undefined,
  ...overrides,
});

describe("matchRequest", () => {
  it("passes a fully matching request", () => {
    const expectation = step("s1", {
      method: "POST",
      path: "/api/v1/things",
      headers: { "x-secret-key": "sk_123" },
      requireHeaders: ["x-nonce"],
      body: { a: 1, nested: { list: [1, 2] } },
    }, { status: 200 });

    const violations = matchRequest(expectation, actual({
      method: "POST",
      path: "/api/v1/things",
      headers: { "x-secret-key": "sk_123", "x-nonce": "abc" },
      contentType: "application/json",
      body: { a: 1, nested: { list: [1, 2] } },
    }));

    expect(violations).toEqual([]);
  });

  it("matches header names case-insensitively", () => {
    const expectation = step("s1", {
      method: "GET",
      path: "/p",
      headers: { "X-Publishable-Key": "pk_1" },
    }, { status: 200 });

    const violations = matchRequest(
      expectation,
      actual({ path: "/p", headers: { "x-pUBLISHABLE-kEY": "pk_1" } }),
    );

    expect(violations).toEqual([]);
  });

  it("ignores transport-controlled headers and query strings", () => {
    const expectation = step("s1", {
      method: "GET",
      path: "/p",
      headers: { host: "ignored.example.com", date: "Mon" },
    }, { status: 200 });

    const violations = matchRequest(
      expectation,
      actual({ path: "/p", headers: { host: "other.example.com", date: "Tue" } }),
    );

    expect(violations).toEqual([]);
  });

  it("reports missing required headers even when other checks fail too", () => {
    const expectation = step("s1", {
      method: "DELETE",
      path: "/wrong",
      requireHeaders: ["x-a", "x-b"],
      body: {},
    }, { status: 200 });

    const violations = matchRequest(
      expectation,
      actual({
        method: "POST",
        path: "/also-wrong",
        headers: { "x-a": "" },
        contentType: "text/plain",
        body: {},
      }),
    );

    expect(violations.map((violation) => violation.kind)).toEqual([
      "method-mismatch",
      "path-mismatch",
      "content-type-mismatch",
      "header-missing",
      "header-missing",
    ]);
  });

  it("tolerates tiny float differences but not real ones", () => {
    const expectation = step("s1", { method: "POST", path: "/p", body: { price: 9.99, count: 3 } }, { status: 200 });

    const tolerant = matchRequest(
      expectation,
      actual({ method: "POST", path: "/p", contentType: "application/json", body: { price: 9.9900000001, count: 3 } }),
    );
    expect(tolerant).toEqual([]);

    const strict = matchRequest(
      expectation,
      actual({ method: "POST", path: "/p", contentType: "application/json", body: { price: 10.5, count: 3 } }),
    );
    expect(strict).toHaveLength(1);
    expect(strict[0]?.kind).toBe("body-mismatch");
  });

  it("produces precise JSON pointers for nested mismatches and extra keys", () => {
    const expectation = step(
      "s1",
      { method: "POST", path: "/p", body: { a: { b: [1, { c: "x" }] }, keep: true } },
      { status: 200 },
    );

    const violations = matchRequest(
      expectation,
      actual({
        method: "POST",
        path: "/p",
        contentType: "application/json",
        body: { a: { b: [1, { c: "y" }] }, keep: true, extra: false },
      }),
    );

    expect(violations).toHaveLength(1);
    const violation = violations[0];
    if (violation?.kind !== "body-mismatch") throw new Error("expected body-mismatch");
    expect(violation.diffs.map((diff) => diff.pointer)).toEqual(["/a/b/1/c", "/extra"]);
  });

  it("flags array length differences", () => {
    const expectation = step("s1", { method: "POST", path: "/p", body: { items: [1, 2] } }, { status: 200 });
    const violations = matchRequest(
      expectation,
      actual({ method: "POST", path: "/p", contentType: "application/json", body: { items: [1] } }),
    );
    expect(violations).toHaveLength(1);
    const violation = violations[0];
    if (violation?.kind !== "body-mismatch") throw new Error("expected body-mismatch");
    expect(violation.diffs[0]?.pointer).toBe("/items/1");
    expect(violation.diffs[0]?.expected).toBe(2);
  });

  it("reports a body mismatch when the request has no body", () => {
    const expectation = step("s1", { method: "POST", path: "/p", body: { a: 1 } }, { status: 200 });
    const violations = matchRequest(expectation, actual({ method: "POST", path: "/p" }));
    expect(violations.map((violation) => violation.kind)).toEqual([
      "content-type-mismatch",
      "body-mismatch",
    ]);
  });
});
