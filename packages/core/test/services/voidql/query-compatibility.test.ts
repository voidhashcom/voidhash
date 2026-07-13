/**
 * The supported VoidQL query corpus. Every accepted query is compiled through the
 * tenant verifier, so adding syntax here also proves that all newly reachable base
 * relations remain scoped. Keep this file exhaustive for the intentionally exposed
 * ClickHouse SELECT surface; administrative, mutating, external-source, and
 * settings/output clauses belong in the permanent rejection corpus below.
 */
import { ClickhouseWebClient } from "@voidhash/clickhouse-db/clickhouse-client-web";
import { Effect } from "effect";
import * as Reactivity from "effect/unstable/reactivity/Reactivity";

import { describe, expect, it } from "../../../src/testing/effect-vitest.ts";

import type { Capability } from "../../../src/services/voidql/catalog/types.ts";
import { compileToIr } from "../../../src/services/voidql/compile.ts";
import { registeredFunctionNames } from "../../../src/services/voidql/functions.ts";
import { renderDebugSql, toStatement } from "../../../src/services/voidql/ir.ts";
import { makeAuthorizedScope } from "../../../src/services/voidql/scope.ts";
import { verify } from "../../../src/services/voidql/verify.ts";

const SCOPE = makeAuthorizedScope({
  organizationId: "org_compatibility",
  availableProjectIds: ["project_a", "project_b"],
});
const CAPABILITIES = new Set<Capability>(["pii"]);

interface SupportedQuery {
  readonly name: string;
  readonly sql: string;
  readonly baseReferences: number;
  readonly contains?: readonly string[];
  readonly boundValues?: readonly unknown[];
}

const SUPPORTED_QUERIES: readonly SupportedQuery[] = [
  {
    name: "constant SELECT without FROM",
    sql: "SELECT 1 AS one, true AS enabled, NULL AS missing",
    baseReferences: 0,
  },
  {
    name: "explicit and implicit projection aliases",
    sql: "SELECT event_name AS explicit_name, project_id implicit_project FROM events",
    baseReferences: 1,
    contains: ["AS explicit_name", "AS implicit_project"],
  },
  {
    name: "expression alias reused by a later projection",
    sql: "SELECT upper(event_name) AS normalized, length(normalized) AS normalized_length FROM events",
    baseReferences: 1,
    contains: ["upper(", "length(normalized)"],
  },
  {
    name: "projection alias reused in WHERE",
    sql: "SELECT lower(event_name) AS normalized FROM events WHERE normalized LIKE 'purchase%'",
    baseReferences: 1,
    contains: ["WHERE (normalized LIKE"],
    boundValues: ["purchase%"],
  },
  {
    name: "projection aliases reused in GROUP BY, HAVING, and ORDER BY",
    sql: "SELECT toStartOfDay(event_ts) AS day, count() AS total FROM events GROUP BY day HAVING total > 1 ORDER BY total DESC",
    baseReferences: 1,
    contains: ["GROUP BY day", "HAVING (total >", "ORDER BY total DESC"],
  },
  {
    name: "explicit table alias",
    sql: "SELECT e.event_id FROM events AS e",
    baseReferences: 1,
    contains: ["AS e", "e.event_id"],
  },
  {
    name: "implicit table alias",
    sql: "SELECT e.event_id FROM events e",
    baseReferences: 1,
    contains: ["AS e", "e.event_id"],
  },
  {
    name: "SELECT ALL",
    sql: "SELECT ALL event_name FROM events",
    baseReferences: 1,
  },
  {
    name: "SELECT DISTINCT",
    sql: "SELECT DISTINCT event_name FROM events",
    baseReferences: 1,
    contains: ["SELECT DISTINCT"],
  },
  {
    name: "SELECT DISTINCT ON",
    sql: "SELECT DISTINCT ON (person_id) person_id, event_ts FROM events ORDER BY event_ts DESC",
    baseReferences: 1,
    contains: ["SELECT DISTINCT ON (", "ORDER BY"],
  },
  {
    name: "arithmetic precedence and unary negation",
    sql: "SELECT -(1 + 2 * 3) AS result FROM events LIMIT 1",
    baseReferences: 1,
  },
  {
    name: "boolean comparison precedence",
    sql: "SELECT event_id FROM events WHERE event_name = 'a' OR event_name = 'b' AND project_id != 'c'",
    baseReferences: 1,
    boundValues: ["a", "b", "c"],
  },
  {
    name: "LIKE and NOT LIKE",
    sql: "SELECT event_id FROM events WHERE event_name LIKE 'a%' AND event_name NOT LIKE '%bot%'",
    baseReferences: 1,
    boundValues: ["a%", "%bot%"],
  },
  {
    name: "ILIKE and NOT ILIKE",
    sql: "SELECT event_id FROM events WHERE event_name ILIKE 'a%' AND event_name NOT ILIKE '%bot%'",
    baseReferences: 1,
    contains: [" ILIKE ", " NOT ILIKE "],
    boundValues: ["a%", "%bot%"],
  },
  {
    name: "IN and NOT IN literal lists",
    sql: "SELECT event_id FROM events WHERE event_name IN ('a', 'b') AND project_id NOT IN ('x', 'y')",
    baseReferences: 1,
    boundValues: ["a", "b", "x", "y"],
  },
  {
    name: "BETWEEN and NOT BETWEEN",
    sql: "SELECT event_id FROM events WHERE event_ts BETWEEN '2026-01-01' AND '2026-01-31' AND event_name NOT BETWEEN 'a' AND 'z'",
    baseReferences: 1,
  },
  {
    name: "IS NULL and IS NOT NULL",
    sql: "SELECT event_id FROM events WHERE person_id IS NULL OR distinct_id IS NOT NULL",
    baseReferences: 1,
  },
  {
    name: "searched and simple CASE",
    sql: "SELECT CASE WHEN event_name = 'a' THEN 'first' ELSE 'other' END AS searched, CASE event_name WHEN 'b' THEN 'second' ELSE 'other' END AS simple FROM events",
    baseReferences: 1,
    boundValues: ["a", "first", "b", "second", "other"],
  },
  {
    name: "PREWHERE lowered safely ahead of WHERE",
    sql: "SELECT event_id FROM events PREWHERE event_ts >= '2026-01-01' WHERE event_name = 'signup'",
    baseReferences: 1,
    contains: [" WHERE ", " AND "],
    boundValues: ["signup"],
  },
  {
    name: "GROUP BY and HAVING",
    sql: "SELECT event_name, count() AS total FROM events GROUP BY event_name HAVING count() > 10",
    baseReferences: 1,
    contains: ["GROUP BY", "HAVING"],
  },
  {
    name: "GROUP BY WITH ROLLUP and TOTALS",
    sql: "SELECT event_name, count() AS total FROM events GROUP BY event_name WITH ROLLUP WITH TOTALS",
    baseReferences: 1,
    contains: ["WITH ROLLUP", "WITH TOTALS"],
  },
  {
    name: "GROUP BY WITH CUBE",
    sql: "SELECT event_name, project_id, count() AS total FROM events GROUP BY event_name, project_id WITH CUBE",
    baseReferences: 1,
    contains: ["WITH CUBE"],
  },
  {
    name: "multi-column ORDER BY",
    sql: "SELECT event_name, event_ts FROM events ORDER BY event_name ASC, event_ts DESC",
    baseReferences: 1,
    contains: ["ORDER BY", " ASC", " DESC"],
  },
  {
    name: "ORDER BY NULLS FIRST and NULLS LAST",
    sql: "SELECT event_name, event_ts FROM events ORDER BY event_name ASC NULLS FIRST, event_ts DESC NULLS LAST",
    baseReferences: 1,
    contains: ["NULLS FIRST", "NULLS LAST"],
  },
  {
    name: "row-number window with partition and ordering",
    sql: "SELECT event_id, rowNumber() OVER (PARTITION BY person_id ORDER BY event_ts DESC) AS row_num FROM events",
    baseReferences: 1,
    contains: ["row_number() OVER (PARTITION BY", "ORDER BY"],
  },
  {
    name: "aggregate window with an unbounded frame",
    sql: "SELECT event_id, sum(1) OVER (PARTITION BY person_id ORDER BY event_ts ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS running_total FROM events",
    baseReferences: 1,
    contains: ["ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW"],
  },
  {
    name: "QUALIFY over a window alias",
    sql: "SELECT event_id, rowNumber() OVER (PARTITION BY person_id ORDER BY event_ts DESC) AS row_num FROM events QUALIFY row_num = 1",
    baseReferences: 1,
    contains: [" QUALIFY (row_num ="],
  },
  {
    name: "LIMIT count OFFSET offset",
    sql: "SELECT event_id FROM events LIMIT 10 OFFSET 5",
    baseReferences: 1,
    contains: ["LIMIT 10 OFFSET 5"],
  },
  {
    name: "LIMIT offset, count",
    sql: "SELECT event_id FROM events LIMIT 5, 10",
    baseReferences: 1,
    contains: ["LIMIT 10 OFFSET 5"],
  },
  {
    name: "LIMIT WITH TIES",
    sql: "SELECT event_name FROM events ORDER BY event_name LIMIT 10 WITH TIES",
    baseReferences: 1,
    contains: ["LIMIT 10 WITH TIES"],
  },
  {
    name: "LIMIT BY plus result LIMIT",
    sql: "SELECT event_name, event_ts FROM events ORDER BY event_ts DESC LIMIT 2 BY event_name LIMIT 10",
    baseReferences: 1,
    contains: ["LIMIT 2 BY", "LIMIT 10"],
  },
  {
    name: "INNER JOIN with ON",
    sql: "SELECT e.event_id FROM events AS e INNER JOIN persons AS p ON p.person_id = e.person_id",
    baseReferences: 2,
    contains: ["INNER JOIN", " ON "],
  },
  {
    name: "LEFT OUTER JOIN",
    sql: "SELECT e.event_id FROM events AS e LEFT OUTER JOIN persons AS p ON p.person_id = e.person_id",
    baseReferences: 2,
    contains: ["LEFT JOIN"],
  },
  {
    name: "RIGHT OUTER JOIN",
    sql: "SELECT e.event_id FROM events AS e RIGHT OUTER JOIN persons AS p ON p.person_id = e.person_id",
    baseReferences: 2,
    contains: ["RIGHT JOIN"],
  },
  {
    name: "FULL OUTER JOIN",
    sql: "SELECT e.event_id FROM events AS e FULL OUTER JOIN persons AS p ON p.person_id = e.person_id",
    baseReferences: 2,
    contains: ["FULL JOIN"],
  },
  {
    name: "CROSS JOIN",
    sql: "SELECT count() AS combinations FROM events AS e CROSS JOIN persons AS p",
    baseReferences: 2,
    contains: ["CROSS JOIN"],
  },
  {
    name: "JOIN USING",
    sql: "SELECT e.event_name FROM events AS e JOIN persons AS p USING (project_id)",
    baseReferences: 2,
    contains: ["USING (project_id)"],
  },
  {
    name: "derived-table subquery",
    sql: "SELECT recent.event_id FROM (SELECT event_id FROM events WHERE event_ts >= '2026-01-01') AS recent",
    baseReferences: 1,
  },
  {
    name: "scalar subquery",
    sql: "SELECT (SELECT count() FROM persons) AS person_count",
    baseReferences: 1,
    contains: ["( SELECT count()"],
  },
  {
    name: "IN subquery",
    sql: "SELECT event_id FROM events WHERE event_id IN (SELECT event_id FROM events WHERE event_name = 'signup')",
    baseReferences: 2,
    boundValues: ["signup"],
  },
  {
    name: "EXISTS subquery",
    sql: "SELECT e.event_id FROM events AS e WHERE EXISTS (SELECT p.person_id FROM persons AS p WHERE p.project_id = 'project_a')",
    baseReferences: 2,
    contains: ["EXISTS ( SELECT"],
    boundValues: ["project_a"],
  },
  {
    name: "NOT EXISTS subquery",
    sql: "SELECT e.event_id FROM events AS e WHERE NOT EXISTS (SELECT p.person_id FROM persons AS p WHERE p.project_id = 'project_a')",
    baseReferences: 2,
    contains: ["NOT EXISTS"],
    boundValues: ["project_a"],
  },
  {
    name: "single CTE",
    sql: "WITH recent AS (SELECT event_id FROM events WHERE event_ts >= '2026-01-01') SELECT count() AS total FROM recent",
    baseReferences: 1,
    contains: ["WITH recent AS"],
  },
  {
    name: "dependent CTEs",
    sql: "WITH base AS (SELECT event_id FROM events), copied AS (SELECT event_id FROM base) SELECT count() AS total FROM copied",
    baseReferences: 1,
    contains: ["WITH base AS", ", copied AS"],
  },
  {
    name: "UNION ALL",
    sql: "SELECT event_id AS id FROM events UNION ALL SELECT person_id AS id FROM persons",
    baseReferences: 2,
    contains: [" UNION ALL ", ") AS voidql_union LIMIT 100000"],
  },
  {
    name: "three UNION ALL arms",
    sql: "SELECT event_id AS id FROM events UNION ALL SELECT person_id AS id FROM persons UNION ALL SELECT event_id AS id FROM revenue",
    baseReferences: 3,
    contains: [" UNION ALL "],
  },
  {
    name: "UNION DISTINCT",
    sql: "SELECT event_id AS id FROM events UNION DISTINCT SELECT person_id AS id FROM persons",
    baseReferences: 2,
    contains: [" UNION DISTINCT "],
  },
  {
    name: "INTERSECT",
    sql: "SELECT project_id FROM events INTERSECT SELECT project_id FROM persons",
    baseReferences: 2,
    contains: [" INTERSECT "],
  },
  {
    name: "EXCEPT",
    sql: "SELECT project_id FROM events EXCEPT SELECT project_id FROM persons",
    baseReferences: 2,
    contains: [" EXCEPT "],
  },
  {
    name: "UNION ALL inside a CTE",
    sql: "WITH ids AS (SELECT event_id AS id FROM events UNION ALL SELECT person_id AS id FROM persons) SELECT count() AS total FROM ids",
    baseReferences: 2,
  },
  {
    name: "aggregate function family",
    sql: "SELECT count(), countIf(event_name = 'a'), countDistinct(person_id), sum(1), sumIf(1, event_name = 'a'), avg(1), min(event_ts), max(event_ts), any(event_name), argMin(event_name, event_ts), argMax(event_name, event_ts) FROM events",
    baseReferences: 1,
  },
  {
    name: "conditional function family",
    sql: "SELECT if(event_name = 'a', 'yes', 'no'), multiIf(event_name = 'a', 'a', event_name = 'b', 'b', 'other'), coalesce(person_id, distinct_id), nullIf(person_id, ''), ifNull(person_id, ''), greatest(1, 2), least(1, 2) FROM events",
    baseReferences: 1,
  },
  {
    name: "string function family",
    sql: "SELECT lower(event_name), upper(event_name), length(event_name), trim(event_name), concat(event_name, project_id), substring(event_name, 1, 3), startsWith(event_name, 'a'), endsWith(event_name, 'z'), position(event_name, 'x'), replaceAll(event_name, 'a', 'b'), match(event_name, '^a'), replaceRegexpAll(event_name, 'a', 'b'), cityHash64(event_id) FROM events",
    baseReferences: 1,
  },
  {
    name: "date function family",
    sql: "SELECT toStartOfMinute(event_ts), toStartOfHour(event_ts), toStartOfDay(event_ts), toStartOfWeek(event_ts), toStartOfMonth(event_ts), toStartOfQuarter(event_ts), toStartOfYear(event_ts), toDate(event_ts), dateDiff('day', event_ts, event_ts), toYear(event_ts), toMonth(event_ts), toDayOfWeek(event_ts) FROM events",
    baseReferences: 1,
  },
  {
    name: "math and safe cast function family",
    sql: "SELECT round(amount_usd, 2), floor(amount_usd), ceil(amount_usd), abs(amount_usd), sqrt(amount_usd), pow(amount_usd, 2), exp(amount_usd), log(amount_usd), toFloat64OrNull(properties.amount), toInt64OrNull(properties.quantity), toDateOrNull(properties.date) FROM revenue",
    baseReferences: 1,
  },
  {
    name: "JSON property namespaces",
    sql: "SELECT properties.plan, context.locale FROM events WHERE properties.plan = 'pro'",
    baseReferences: 1,
    boundValues: ["plan", "locale", "pro"],
  },
  {
    name: "PII columns and traits with capability",
    sql: "SELECT email, name, traits.plan FROM persons WHERE traits.plan = 'pro'",
    baseReferences: 1,
    boundValues: ["plan", "pro"],
  },
  {
    name: "qualified catalog star",
    sql: "SELECT e.* FROM events AS e",
    baseReferences: 1,
  },
  {
    name: "comments and trailing semicolon",
    sql: "/* leading */ SELECT event_id -- projection\nFROM events;",
    baseReferences: 1,
  },
];

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

const describeClickhouse = process.env.VOIDQL_CLICKHOUSE_TEST === "1" ? describe : describe.skip;

describeClickhouse("VoidQL live ClickHouse compatibility", () => {
  it("executes every supported query through the real parameter substrate", async () => {
    const ch = await Effect.runPromise(
      ClickhouseWebClient.makeUnchecked(() => ({
        url: process.env.CLICKHOUSE_URL ?? "http://127.0.0.1:8123",
        database: process.env.CLICKHOUSE_DATABASE ?? "voidhash",
        username: process.env.CLICKHOUSE_ANALYTICS_QUERY_USERNAME ?? "voidhash_query",
        password: process.env.CLICKHOUSE_ANALYTICS_QUERY_PASSWORD ?? "password",
      })).pipe(Effect.provide(Reactivity.layer)),
    );

    for (const testCase of SUPPORTED_QUERIES) {
      const compiled = compileToIr(testCase.sql, SCOPE, CAPABILITIES);
      await Effect.runPromise(
        toStatement(ch, compiled.pieces).pipe(
          Effect.mapError(
            (cause) =>
              new Error(`ClickHouse rejected compatibility case '${testCase.name}'.`, {
                cause,
              }),
          ),
        ),
      );
    }
  });
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

const PERMANENTLY_REJECTED = [
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
] as const;

describe("VoidQL permanent security boundary", () => {
  for (const sql of PERMANENTLY_REJECTED) {
    it(`rejects ${sql}`, () => {
      expect(() => compileToIr(sql, SCOPE, CAPABILITIES)).toThrow();
    });
  }
});
