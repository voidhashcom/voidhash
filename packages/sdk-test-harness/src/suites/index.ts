import { apiCoreSuite, mobileCoreSuite } from "./core-suites";
import type { ConformanceSuite } from "../types";

/** Suite used by harness self-tests to exercise multi-response (retry) steps. */
export const testRetrySuite: ConformanceSuite = {
  name: "test/retry",
  category: "api",
  description: "Harness self-test: a step whose first response fails and second succeeds.",
  steps: [
    {
      id: "flaky-then-success",
      request: { method: "GET", path: "/test/flaky" },
      responses: [
        { status: 500, body: { _tag: "Api/SdkServiceError", cause: "transient" } },
        { status: 200, body: { ok: true } },
      ],
    },
  ],
};

const SUITES: ReadonlyArray<ConformanceSuite> = [
  apiCoreSuite,
  mobileCoreSuite,
  testRetrySuite,
];

const SUITES_BY_NAME: ReadonlyMap<string, ConformanceSuite> = new Map(
  SUITES.map((suite) => [suite.name, suite]),
);

export const listSuites = (): ReadonlyArray<ConformanceSuite> => SUITES;

export const getSuite = (name: string): ConformanceSuite | undefined =>
  SUITES_BY_NAME.get(name);
