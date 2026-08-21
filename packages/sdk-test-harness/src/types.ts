/** JSON value shape used across scenario descriptors, bodies, and reports. */
export type Json =
  | string
  | number
  | boolean
  | null
  | readonly Json[]
  | { readonly [key: string]: Json };

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface ExpectedRequest {
  readonly method: HttpMethod;
  /** Absolute path starting with `/`; literal fixture values, no templates. */
  readonly path: `/${string}`;
  /** Headers that must be present with exactly this value (names are case-insensitive). */
  readonly headers?: Readonly<Record<string, string>>;
  /** Headers that must be present with a non-empty value; the value itself may vary (nonces, versions). */
  readonly requireHeaders?: ReadonlyArray<string>;
  readonly body?: Json;
}

export interface ScriptedResponse {
  readonly status: number;
  readonly body?: Json;
}

export interface ScenarioStep {
  readonly id: string;
  readonly request: ExpectedRequest;
  /**
   * Responses are consumed in order: the first request matching this step gets
   * `responses[0]`, a retried request gets `responses[1]`, and so on. When all
   * responses are consumed the harness advances to the next step.
   */
  readonly responses: ReadonlyArray<ScriptedResponse>;
}

export interface ConformanceSuite {
  readonly name: string;
  readonly category: "api" | "mobile";
  readonly description: string;
  readonly steps: ReadonlyArray<ScenarioStep>;
}

/** Builds a scenario step from an expectation and one or more scripted responses. */
export const step = (
  id: string,
  request: ExpectedRequest,
  responses: ScriptedResponse | ReadonlyArray<ScriptedResponse>,
): ScenarioStep => {
  if ("status" in responses) {
    return { id, request, responses: [responses] };
  }
  return { id, request, responses };
};

// ---------------------------------------------------------------------------
// Violations & reports
// ---------------------------------------------------------------------------

export interface JsonDiff {
  readonly pointer: string;
  readonly expected: Json | undefined;
  readonly actual: Json | undefined;
}

export type Violation =
  | { readonly kind: "unexpected-request"; readonly detail: string }
  | { readonly kind: "missing-step"; readonly stepId: string }
  | { readonly kind: "method-mismatch"; readonly expected: string; readonly actual: string }
  | { readonly kind: "path-mismatch"; readonly expected: string; readonly actual: string }
  | {
      readonly kind: "header-mismatch";
      readonly header: string;
      readonly expected: string;
      readonly actual: string;
    }
  | { readonly kind: "header-missing"; readonly header: string }
  | { readonly kind: "content-type-mismatch"; readonly contentType: string }
  | { readonly kind: "body-mismatch"; readonly diffs: ReadonlyArray<JsonDiff> };

export interface RecordedExchange {
  readonly index: number;
  readonly stepId: string | null;
  readonly method: string;
  readonly path: string;
  readonly matched: boolean;
  readonly violations: ReadonlyArray<Violation>;
}

export interface SessionReport {
  readonly pass: boolean;
  readonly suite: string;
  readonly totalSteps: number;
  readonly executedExchanges: number;
  readonly exchanges: ReadonlyArray<RecordedExchange>;
  readonly violations: ReadonlyArray<Violation>;
}
