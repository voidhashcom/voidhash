/**
 * Cross-checks that the pure {@link SqlPiece} IR replays faithfully through the
 * real `ch` substrate: `toStatement(ch, pieces).compile()` must reproduce exactly
 * the SQL text + ordered binds that {@link renderDebugSql} predicts. This ties the
 * verifier's view of the query (the IR) to the bytes that actually reach ClickHouse
 * — every user value a bound `{pN:Type}` placeholder, never spliced.
 *
 * Uses `ClickhouseWebClient.makeUnchecked`, which builds no connection until the
 * first query; `.compile()` is pure, so no ClickHouse is contacted.
 */
import { ClickhouseWebClient } from "@voidhash/clickhouse-db/clickhouse-client-web";
import { Effect } from "effect";
import * as Reactivity from "effect/unstable/reactivity/Reactivity";

import { describe, expect, it } from "../../../src/testing/effect-vitest.ts";

import type { Capability } from "../../../src/services/voidql/catalog/types.ts";
import { compileToIr } from "../../../src/services/voidql/compile.ts";
import { renderDebugSql, toStatement } from "../../../src/services/voidql/ir.ts";
import { makeAuthorizedScope } from "../../../src/services/voidql/scope.ts";

const SCOPE = makeAuthorizedScope({
  organizationId: "org_a",
  availableProjectIds: ["proj_1", "proj_2"],
});

const makeClient = () =>
  Effect.runPromise(
    ClickhouseWebClient.makeUnchecked(() => ({ url: "http://localhost:8123" })).pipe(
      Effect.provide(Reactivity.layer),
    ),
  );

describe("VoidQL IR ↔ ch substrate", () => {
  it("toStatement().compile() reproduces the IR's SQL text and binds exactly", async () => {
    const ch = await makeClient();
    const cases = [
      "SELECT event_name, count() AS n FROM events WHERE event_ts >= '2026-01-01' GROUP BY event_name",
      "SELECT count() AS n FROM events WHERE properties.plan = 'pro'",
      "SELECT e.event_name FROM events AS e JOIN ( SELECT distinct_id FROM persons WHERE distinct_id != '' ) AS p ON p.distinct_id = e.distinct_id",
    ];
    for (const text of cases) {
      const ir = compileToIr(text, SCOPE, new Set<Capability>(["pii"]));
      const expected = renderDebugSql(ir.pieces);
      const [sql, params] = toStatement(ch, ir.pieces).compile();
      expect(sql).toBe(expected.sql);
      expect(params).toEqual(expected.binds);
    }
  });
});
