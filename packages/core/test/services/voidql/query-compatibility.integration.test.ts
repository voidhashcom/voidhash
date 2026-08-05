/**
 * Executes the supported VoidQL corpus against a live ClickHouse, proving the
 * compiled SQL is accepted by the real parameter substrate rather than only by
 * the compiler's own model of it.
 *
 * Previously an environment-gated block inside the unit suite, where it never
 * ran: the flag was set by no tier.
 *
 * The connection comes from the harness — {@link ClickhouseWebClient} bound to
 * the injected test connections — rather than from the environment, so the case
 * runs unchanged under every composition: the self-host stack locally, a
 * provisioned deployment downstream. Only acceptance is asserted, so the
 * harness's read-write binding proves what a least-privilege one would: every
 * compiled statement parses, resolves, and binds its parameters.
 */
import { ClickhouseWebClient } from "@voidhash/clickhouse-db/clickhouse-client-web";
import { Effect } from "effect";
import { describe } from "vitest";

import { CoreIntegrationTestHarness } from "@testing/CoreIntegrationTestHarness";

import { compileToIr } from "../../../src/services/voidql/compile.ts";
import { toStatement } from "../../../src/services/voidql/ir.ts";
import { CAPABILITIES, SCOPE, SUPPORTED_QUERIES } from "./corpus.ts";

const { test } = CoreIntegrationTestHarness.make();

describe("VoidQL live ClickHouse compatibility", () => {
  test(
    "executes every supported query through the real parameter substrate",
    Effect.gen(function* () {
      const ch = yield* ClickhouseWebClient.ClickhouseWebClient;

      for (const testCase of SUPPORTED_QUERIES) {
        const compiled = compileToIr(testCase.sql, SCOPE, CAPABILITIES);
        yield* toStatement(ch, compiled.pieces).pipe(
          Effect.mapError(
            (cause) =>
              new Error(`ClickHouse rejected compatibility case '${testCase.name}'.`, {
                cause,
              }),
          ),
        );
      }
    }),
  );
});
