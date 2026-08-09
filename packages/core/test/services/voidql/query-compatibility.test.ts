/**
 * The supported VoidQL query corpus. Every accepted query is compiled through the
 * tenant verifier, so adding syntax here also proves that all newly reachable base
 * relations remain scoped. Keep this file exhaustive for the intentionally exposed
 * ClickHouse SELECT surface; administrative, mutating, external-source, and
 * settings/output clauses belong in the permanent rejection corpus below.
 */
import { constant } from "@voidhash/lib/lang";

import { describe, expect, it } from "../../../src/testing/effect-vitest.ts";

import { compileToIr } from "../../../src/services/voidql/compile.ts";
import { registeredFunctionNames } from "../../../src/services/voidql/functions.ts";
import { renderDebugSql } from "../../../src/services/voidql/ir.ts";
import { verify } from "../../../src/services/voidql/verify.ts";
import {
  CAPABILITIES,
  SCOPE,
  SUPPORTED_QUERIES,
} from "./corpus.ts";

describe("VoidQL supported ClickHouse SELECT compatibility corpus", () => {
  for (const testCase of SUPPORTED_QUERIES) {
    it(testCase.name, () => {
      const compiled = compileToIr(testCase.sql, SCOPE, CAPABILITIES);
      verify(compiled.pieces, compiled.injected, SCOPE);
      const rendered = renderDebugSql(compiled.pieces);

      expect(compiled.injected).toHaveLength(testCase.baseReferences);
      expect(rendered.sql).not.toMatch(/\bSETTINGS\b|\bFORMAT\b/i);
      for (const fragment of testCase.contains ?? []) expect(rendered.sql).toContain(fragment);
      for (const value of testCase.boundValues ?? []) expect(rendered.binds).toContainEqual(value);
    });
  }
});

describe("VoidQL function allowlist snapshot", () => {
  it("lists every callable function intentionally", () => {
    expect([...registeredFunctionNames()].sort()).toEqual(
      [
        "abs",
        "any",
        "argmax",
        "argmin",
        "avg",
        "ceil",
        "cityhash64",
        "coalesce",
        "concat",
        "count",
        "countdistinct",
        "countif",
        "datediff",
        "denserank",
        "endswith",
        "exp",
        "floor",
        "greatest",
        "if",
        "ifnull",
        "least",
        "length",
        "log",
        "lower",
        "match",
        "max",
        "min",
        "multiif",
        "nullif",
        "position",
        "pow",
        "replaceall",
        "replaceregexpall",
        "rank",
        "round",
        "rownumber",
        "sqrt",
        "startswith",
        "substring",
        "sum",
        "sumif",
        "todateornull",
        "todate",
        "tofloat64ornull",
        "toint64ornull",
        "tomonth",
        "tostartofday",
        "tostartofhour",
        "tostartofminute",
        "tostartofmonth",
        "tostartofquarter",
        "tostartofweek",
        "tostartofyear",
        "todayofweek",
        "toyear",
        "trim",
        "upper",
      ].sort(),
    );
  });
});

const PERMANENTLY_REJECTED = constant([
  "SELECT event_id FROM events SETTINGS max_threads = 1",
  "SELECT event_id FROM events FORMAT JSON",
  "SELECT event_id FROM events INTO OUTFILE 'result.csv'",
  "SELECT * FROM url('https://example.com/data.csv')",
  "SELECT * FROM system.tables",
  "SELECT currentUser() AS user",
  "SELECT event_id FROM events FINAL",
  "SELECT event_id FROM events SAMPLE 0.1",
  "INSERT INTO events VALUES (1)",
  "UPDATE events SET event_name = 'x'",
  "DELETE FROM events WHERE true",
  "DROP TABLE events",
  "SELECT event_id FROM events UNION SELECT event_id FROM events",
  "SELECT e.event_id FROM events AS e WHERE EXISTS (SELECT p.person_id FROM persons AS p WHERE p.person_id = e.person_id)",
  "SELECT sum(1) OVER (ORDER BY event_ts ROWS BETWEEN 2 PRECEDING AND CURRENT ROW) FROM events",
  "SELECT rowNumber() FROM events",
  "SELECT e.*, p.* FROM events AS e JOIN persons AS p ON e.person_id = p.person_id",
]);

describe("VoidQL permanent security boundary", () => {
  for (const sql of PERMANENTLY_REJECTED) {
    it(`rejects ${sql}`, () => {
      expect(() => compileToIr(sql, SCOPE, CAPABILITIES)).toThrow();
    });
  }
});
