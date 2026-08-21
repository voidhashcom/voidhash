import type { ExpectedRequest, Json, JsonDiff, ScenarioStep, Violation } from "../types";

/**
 * Headers that are transport-controlled and never asserted. Everything else
 * declared on a step is matched exactly (names case-insensitively).
 */
const IGNORED_HEADERS: ReadonlySet<string> = new Set([
  "host",
  "connection",
  "content-length",
  "content-type",
  "accept",
  "accept-encoding",
  "accept-language",
  "user-agent",
  "date",
  "keep-alive",
  "transfer-encoding",
  "expect",
]);

/** The actual request as observed by the server, after normalization. */
export interface ActualRequest {
  readonly method: string;
  readonly path: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly contentType: string | undefined;
  readonly body: Json | undefined;
}

const headerValue = (
  headers: Readonly<Record<string, string>>,
  name: string,
): string | undefined => {
  const lowered = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === lowered) return value;
  }
  return undefined;
};

const numbersClose = (a: number, b: number): boolean =>
  a === b || Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));

const MAX_BODY_DIFFS = 8;

const isPlainObject = (value: Json): value is { readonly [key: string]: Json } =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const diffJson = (expected: Json, actual: Json, pointer: string, out: Array<JsonDiff>): void => {
  if (out.length >= MAX_BODY_DIFFS) return;

  if (typeof expected === "number" && typeof actual === "number") {
    if (!numbersClose(expected, actual)) {
      out.push({ pointer, expected, actual });
    }
    return;
  }

  if (isPlainObject(expected) && isPlainObject(actual)) {
    const expectedKeys = Object.keys(expected);
    const actualKeys = new Set(Object.keys(actual));
    for (const key of expectedKeys) {
      const expectedValue: Json | undefined = expected[key];
      if (!actualKeys.has(key)) {
        out.push({ pointer: `${pointer}/${key}`, expected: expectedValue, actual: undefined });
        continue;
      }
      actualKeys.delete(key);
      const actualValue: Json | undefined = actual[key];
      if (expectedValue !== undefined && actualValue !== undefined) {
        diffJson(expectedValue, actualValue, `${pointer}/${key}`, out);
      }
      if (out.length >= MAX_BODY_DIFFS) return;
    }
    for (const key of actualKeys) {
      out.push({ pointer: `${pointer}/${key}`, expected: undefined, actual: actual[key] });
    }
    return;
  }

  if (Array.isArray(expected) && Array.isArray(actual)) {
    const length = Math.max(expected.length, actual.length);
    for (let index = 0; index < length; index++) {
      if (index >= expected.length || index >= actual.length) {
        out.push({
          pointer: `${pointer}/${index}`,
          expected: expected[index],
          actual: actual[index],
        });
        return;
      }
      diffJson(expected[index], actual[index], `${pointer}/${index}`, out);
      if (out.length >= MAX_BODY_DIFFS) return;
    }
    return;
  }

  if (expected !== actual) {
    out.push({ pointer, expected, actual });
  }
};

/**
 * Verifies an observed request against a step's expectation and returns every
 * violation found (empty when the request matches). All checks run so one
 * exchange reports the full set of problems instead of just the first.
 */
export const matchRequest = (
  step: ScenarioStep,
  actual: ActualRequest,
): ReadonlyArray<Violation> => {
  const violations: Array<Violation> = [];
  const expected: ExpectedRequest = step.request;

  if (expected.method.toUpperCase() !== actual.method.toUpperCase()) {
    violations.push({
      kind: "method-mismatch",
      expected: expected.method,
      actual: actual.method,
    });
  }

  if (expected.path !== actual.path) {
    violations.push({ kind: "path-mismatch", expected: expected.path, actual: actual.path });
  }

  if (expected.body !== undefined && !(actual.contentType ?? "").startsWith("application/json")) {
    violations.push({
      kind: "content-type-mismatch",
      contentType: actual.contentType ?? "<missing>",
    });
  }

  for (const [name, value] of Object.entries(expected.headers ?? {})) {
    if (IGNORED_HEADERS.has(name.toLowerCase())) continue;
    const actualValue = headerValue(actual.headers, name);
    if (actualValue === undefined) {
      violations.push({ kind: "header-missing", header: name });
    } else if (actualValue !== value) {
      violations.push({ kind: "header-mismatch", header: name, expected: value, actual: actualValue });
    }
  }

  for (const name of expected.requireHeaders ?? []) {
    const actualValue = headerValue(actual.headers, name);
    if (actualValue === undefined || actualValue.trim() === "") {
      violations.push({ kind: "header-missing", header: name });
    }
  }

  if (expected.body !== undefined) {
    if (actual.body === undefined) {
      violations.push({
        kind: "body-mismatch",
        diffs: [{ pointer: "", expected: expected.body, actual: undefined }],
      });
    } else {
      const diffs: Array<JsonDiff> = [];
      diffJson(expected.body, actual.body, "", diffs);
      if (diffs.length > 0) violations.push({ kind: "body-mismatch", diffs });
    }
  }

  return violations;
};

export const renderBodyDiffs = (diffs: ReadonlyArray<JsonDiff>): string =>
  diffs
    .map((diff) =>
      // oxlint-disable-next-line effect/noGlobals -- human-readable report rendering of arbitrary JSON leaves
      `    at \`${diff.pointer || "/"}\`: expected ${JSON.stringify(diff.expected)} got ${JSON.stringify(diff.actual)}`,
    )
    .join("\n");

export const renderViolation = (violation: Violation): string => {
  switch (violation.kind) {
    case "unexpected-request":
      return `unexpected-request: ${violation.detail}`;
    case "missing-step":
      return `missing-step: step "${violation.stepId}" was never executed`;
    case "method-mismatch":
      return `method-mismatch: expected ${violation.expected} got ${violation.actual}`;
    case "path-mismatch":
      return `path-mismatch: expected ${violation.expected} got ${violation.actual}`;
    case "header-mismatch":
      return `header-mismatch: ${violation.header}: expected "${violation.expected}" got "${violation.actual}"`;
    case "header-missing":
      return `header-missing: ${violation.header}`;
    case "content-type-mismatch":
      return `content-type-mismatch: expected application/json got ${violation.contentType}`;
    case "body-mismatch":
      return `body-mismatch:\n${renderBodyDiffs(violation.diffs)}`;
  }
};
