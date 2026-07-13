/**
 * Pure unit tests for the VoidQL compiler — the load-bearing, infra-free core of
 * the analytics access layer (docs/analytics-access-layer.html §19). Covers the
 * golden text→CH-SQL mapping, the **non-negotiable isolation invariant** (every
 * base-ref carries the bound tenant predicate, on the right scope), forbidden-
 * keyword rejection, PII gating, out-of-band parameter binding, and the LIMIT
 * clamp. No ClickHouse, no Db, no Auth.
 */
import { describe, expect, it } from "../../../src/testing/effect-vitest.ts";

import type { Capability } from "../../../src/services/voidql/catalog/types.ts";
import { compileToIr } from "../../../src/services/voidql/compile.ts";
import { lit, renderDebugSql } from "../../../src/services/voidql/ir.ts";
import { makeAuthorizedScope } from "../../../src/services/voidql/scope.ts";
import { verify } from "../../../src/services/voidql/verify.ts";

const SCOPE = makeAuthorizedScope({
  organizationId: "org_a",
  availableProjectIds: ["proj_1", "proj_2"],
});
const PII = new Set<Capability>(["pii"]);
const NO_PII = new Set<Capability>([]);

/** Compile + verify, returning the rendered `(sql, binds)`, columns, and scopes. */
const compile = (text: string, caps: ReadonlySet<Capability> = NO_PII, scope = SCOPE) => {
  const ir = compileToIr(text, scope, caps);
  verify(ir.pieces, ir.injected, scope);
  const rendered = renderDebugSql(ir.pieces);
  return { sql: rendered.sql, binds: rendered.binds, columns: ir.shape, injected: ir.injected };
};

const expectTag = (fn: () => unknown, tag: string): void => {
  try {
    fn();
  } catch (error) {
    expect((error as { _tag?: string })?._tag).toBe(tag);
    return;
  }
  throw new Error(`expected ${tag} to be thrown, but nothing was`);
};

const countOccurrences = (haystack: string, needle: string): number =>
  haystack.split(needle).length - 1;

describe("VoidQL compiler — golden mapping", () => {
  it("lowers a simple aggregation with the injected tenant scope", () => {
    const { sql, binds, columns } = compile(
      "SELECT event_name, count() AS n FROM events WHERE event_ts >= '2026-01-01' GROUP BY event_name",
    );
    // The raw table is wrapped in a scoped subquery; org + projects are bound.
    expect(sql).toContain(
      "FROM events_v2 WHERE organization_id = {p1: String} AND project_id IN {p2: Array(String)}",
    );
    expect(sql).toContain("LIMIT 1 BY event_id");
    // The identity-join (pending_overrides) is scoped inline too (p3/p4), since the
    // analytics_query user has no row policy.
    expect(sql).toContain(
      "FROM person_identity_pending_overrides_v2 WHERE version > 0 AND organization_id = {p3: String} AND project_id IN {p4: Array(String)}",
    );
    // The user's date literal binds out-of-band as DateTime (partition pruning).
    expect(sql).toContain("{p5: DateTime}");
    expect(binds).toEqual([
      "org_a",
      ["proj_1", "proj_2"],
      "org_a",
      ["proj_1", "proj_2"],
      "2026-01-01 00:00:00",
    ]);
    expect(sql.trimEnd().endsWith("LIMIT 100000")).toBe(true);
    expect(columns).toEqual([
      { name: "event_name", type: "String" },
      { name: "n", type: "UInt64" },
    ]);
  });

  it("binds JSON property keys out-of-band, never spliced", () => {
    const { sql, binds } = compile("SELECT count() AS n FROM events WHERE properties.plan = 'pro'");
    // Both the key AND the value are bound params (§9, §18 #1).
    expect(sql).toMatch(/JSONExtractString\(events_0\.event_properties, \{p\d+: String\}\)/);
    expect(binds).toContain("plan");
    expect(binds).toContain("pro");
  });

  it("compiles revenue with amount_usd in dollars", () => {
    const { sql, columns } = compile("SELECT sum(amount_usd) AS total FROM revenue");
    expect(sql).toContain("event_name IN ('$purchase.completed'");
    expect(sql).toContain("/ 100 AS amount_usd");
    expect(columns).toEqual([{ name: "total", type: "Float64" }]);
  });

  it("clamps an over-large LIMIT to the server cap", () => {
    const { sql } = compile("SELECT count() AS n FROM events LIMIT 999999999");
    expect(sql).toContain("LIMIT 100000");
    expect(sql).not.toContain("999999999");
  });

  it("applies one global result cap around UNION ALL arms", () => {
    const { sql } = compile(
      "SELECT event_id AS id FROM events UNION ALL SELECT person_id AS id FROM persons",
    );
    expect(sql.trimEnd().endsWith("AS voidql_union LIMIT 100000")).toBe(true);
  });

  it("expands SELECT * to in-star catalog columns only (never physical *)", () => {
    const { sql, columns } = compile("SELECT * FROM persons", PII);
    expect(sql).not.toMatch(/SELECT \*/);
    // PII columns are excluded from * even with the capability.
    expect(columns.map((c) => c.name)).not.toContain("email");
    expect(columns.map((c) => c.name)).toContain("person_id");
  });
});

describe("VoidQL compiler — tenant isolation invariant", () => {
  it("injects exactly one tenant predicate per base-table reference (JOIN)", () => {
    const { sql, injected } = compile(
      "SELECT e.event_name, count() AS n FROM events AS e " +
        "JOIN ( SELECT distinct_id FROM persons WHERE distinct_id != '' ) AS pro " +
        "ON pro.distinct_id = e.distinct_id GROUP BY e.event_name",
    );
    expect(injected).toHaveLength(2);
    expect(countOccurrences(sql, "events_v2")).toBe(1);
    expect(countOccurrences(sql, "person_identity_pending_overrides_v2")).toBe(1);
    expect(countOccurrences(sql, "persons_v1")).toBe(1);
    // events lowering scopes 2 physical reads (events_v2 + pending_overrides),
    // persons lowering scopes 1 → 2 + 1 = 3 tenant predicates of each kind.
    expect(countOccurrences(sql, "organization_id = {p")).toBe(3);
    expect(countOccurrences(sql, "project_id IN {p")).toBe(3);
  });

  it("scopes every base-ref to the authorized org/projects, never the request", () => {
    const { injected } = compile(
      "SELECT count() AS n FROM events AS a JOIN events AS b ON a.event_id = b.event_id",
    );
    expect(injected).toHaveLength(2);
    for (const scoped of injected) {
      expect(scoped.orgValue).toBe("org_a");
      expect(scoped.projectValues).toEqual(["proj_1", "proj_2"]);
    }
  });

  it("the verifier rejects an unscoped base-ref (guard-stubbed leak)", () => {
    // Simulate a printer bug that emitted a raw base table with no injected scope.
    expectTag(
      () => verify([lit("SELECT 1 FROM events_v2 LIMIT 1")], [], SCOPE),
      "VoidQlIsolationError",
    );
  });

  it("the verifier rejects a scope bound to a different organization", () => {
    const ir = compileToIr("SELECT count() AS n FROM events", SCOPE, NO_PII);
    const otherOrg = makeAuthorizedScope({
      organizationId: "org_b",
      availableProjectIds: ["proj_1", "proj_2"],
    });
    expectTag(() => verify(ir.pieces, ir.injected, otherOrg), "VoidQlIsolationError");
  });

  it("reserves physical-table-shaped aliases so the verifier never false-positives", () => {
    // A user alias like `foo_v1` would otherwise trip the verifier's physical-table
    // token scan; such names are rejected up front (unsupported, not isolation).
    expectTag(() => compile("SELECT count() AS n FROM events AS evt_v2"), "VoidQlUnsupportedError");
    expectTag(() => compile("SELECT event_id AS id_v1 FROM events"), "VoidQlUnsupportedError");
    expectTag(
      () => compile("WITH c_v9 AS ( SELECT event_id FROM events ) SELECT count() AS n FROM c_v9"),
      "VoidQlUnsupportedError",
    );
  });

  it("CTEs inject scope at every depth", () => {
    const { injected, sql } = compile(
      "WITH recent AS ( SELECT event_id, distinct_id FROM events ) " +
        "SELECT count() AS n FROM recent",
    );
    expect(injected).toHaveLength(1);
    expect(countOccurrences(sql, "events_v2")).toBe(1);
  });
});

describe("VoidQL compiler — PII gating", () => {
  it("rejects a PII column without the capability (never null-substitutes)", () => {
    expectTag(() => compile("SELECT email FROM persons"), "VoidQlPiiError");
    expectTag(
      () => compile("SELECT count() AS n FROM persons WHERE email = 'x@y.z'"),
      "VoidQlPiiError",
    );
    expectTag(
      () => compile("SELECT count() AS n FROM persons WHERE traits.plan = 'pro'"),
      "VoidQlPiiError",
    );
  });

  it("allows PII columns with the capability", () => {
    const { sql } = compile("SELECT email, name FROM persons", PII);
    expect(sql).toContain("persons_v1");
  });
});

describe("VoidQL compiler — forbidden + unsupported constructs", () => {
  it("rejects a trailing SETTINGS clause as ungrammatical", () => {
    expectTag(
      () => compile("SELECT count() AS n FROM events SETTINGS max_threads = 1"),
      "VoidQlUnsupportedError",
    );
  });

  it("rejects ambiguous set syntax and DDL", () => {
    expectTag(
      () => compile("SELECT count() AS n FROM events UNION SELECT count() FROM events"),
      "VoidQlUnsupportedError",
    );
    expectTag(() => compile("DROP TABLE events"), "VoidQlUnsupportedError");
  });

  it("rejects multi-column scalar and IN subqueries", () => {
    expectTag(
      () => compile("SELECT (SELECT event_id, person_id FROM events) AS invalid"),
      "VoidQlUnsupportedError",
    );
    expectTag(
      () =>
        compile(
          "SELECT count() AS n FROM events WHERE event_id IN (SELECT event_id, person_id FROM events)",
        ),
      "VoidQlUnsupportedError",
    );
  });

  it("rejects unknown tables, columns, and functions", () => {
    expectTag(() => compile("SELECT 1 AS x FROM nope"), "VoidQlSchemaError");
    expectTag(() => compile("SELECT nope FROM events"), "VoidQlUnknownFieldError");
    expectTag(() => compile("SELECT badfn(event_id) AS x FROM events"), "VoidQlUnsupportedError");
  });

  it("rejects over-deep nesting before recursion blows the stack", () => {
    const deep = `SELECT ${"(".repeat(200)}1${")".repeat(200)} AS x FROM events`;
    expectTag(() => compile(deep), "VoidQlComplexityError");
  });
});

describe("VoidQL compiler — output column naming (shape ↔ SQL parity)", () => {
  it("emits AS for an unaliased computed column so shape matches the CH output name", () => {
    const { sql, columns } = compile("SELECT count() FROM events");
    // Without the explicit AS, ClickHouse would name the column `count()` while
    // the shape reported `expr_0` — the caller would read the wrong key.
    expect(sql).toContain("count() AS expr_0");
    expect(columns).toEqual([{ name: "expr_0", type: "UInt64" }]);
  });

  it("a derived-relation reference to a synthesized column resolves", () => {
    // Previously the inner `count()` had no AS, so `s.expr_0` did not exist in the
    // subquery and ClickHouse rejected the statement with 'Unknown identifier'.
    const { sql, columns } = compile("SELECT expr_0 FROM ( SELECT count() FROM events ) AS s");
    expect(sql).toContain("count() AS expr_0");
    expect(columns).toEqual([{ name: "expr_0", type: "UInt64" }]);
  });
});

describe("VoidQL compiler — robustness (typed errors, never raw defects)", () => {
  it("rejects an unparseable date literal with a typed error, not a RangeError", () => {
    // `new Date('tomorrow').toISOString()` throws a raw RangeError that would escape
    // as an opaque defect/500 and break the validate-repair loop (§18 #9).
    expectTag(
      () => compile("SELECT count() AS n FROM events WHERE event_ts >= 'tomorrow'"),
      "VoidQlSyntaxError",
    );
    expectTag(
      () => compile("SELECT count() AS n FROM events WHERE event_ts = 'not-a-date'"),
      "VoidQlSyntaxError",
    );
    // A valid ISO date still compiles and binds as a DateTime parameter.
    const { binds } = compile("SELECT count() AS n FROM events WHERE event_ts >= '2026-01-01'");
    expect(binds).toContain("2026-01-01 00:00:00");
  });

  it("bounds a unary-minus chain by depth (typed error, not a stack overflow)", () => {
    // The `neg` prefix recurses parsePrefix directly; without a depth guard a long
    // `- - … - x` chain blows the JS stack with a raw RangeError before the node cap.
    const deep = `SELECT ${"- ".repeat(120)}1 AS x FROM events`;
    expectTag(() => compile(deep), "VoidQlComplexityError");
  });
});

describe("VoidQL compiler — verifier backstops (direct IR)", () => {
  it("triangulates revenue and persons-only lowerings, not just events", () => {
    // Exercise verify() end-to-end for the relations the golden tests skip.
    expect(() => compile("SELECT sum(amount_usd) AS total FROM revenue")).not.toThrow();
    expect(() => compile("SELECT count() AS n FROM persons")).not.toThrow();
    const persons = compile("SELECT count() AS n FROM persons");
    expect(countOccurrences(persons.sql, "persons_v1")).toBe(1);
    expect(countOccurrences(persons.sql, "organization_id = {p")).toBe(1);
    const revenue = compile("SELECT sum(amount_usd) AS total FROM revenue");
    // revenue lowers through the events machinery → 2 scoped physical reads.
    expect(countOccurrences(revenue.sql, "organization_id = {p")).toBe(2);
  });

  it("rejects a scope bound to the wrong project set (I1)", () => {
    const ir = compileToIr("SELECT count() AS n FROM events", SCOPE, NO_PII);
    const wrongProjects = makeAuthorizedScope({
      organizationId: "org_a",
      availableProjectIds: ["proj_1"], // missing proj_2
    });
    expectTag(() => verify(ir.pieces, ir.injected, wrongProjects), "VoidQlIsolationError");
  });

  it("rejects forbidden table-functions / introspection in the emitted SQL (I2)", () => {
    for (const token of [
      "remote('h', t)",
      "url('http://x')",
      "s3('x')",
      "getSetting('y')",
      "dictGet('d','a',1)",
    ]) {
      expectTag(() => verify([lit(`SELECT ${token}`)], [], SCOPE), "VoidQlIsolationError");
    }
    expectTag(
      () => verify([lit("SELECT 1 FROM system.tables")], [], SCOPE),
      "VoidQlIsolationError",
    );
  });

  it("rejects an emitted SETTINGS / FORMAT clause (I3 — the override-by-absence net)", () => {
    expectTag(
      () => verify([lit("SELECT 1 SETTINGS max_threads = 1")], [], SCOPE),
      "VoidQlIsolationError",
    );
    expectTag(() => verify([lit("SELECT 1 FORMAT JSON")], [], SCOPE), "VoidQlIsolationError");
  });

  it("rejects a reserved internal alias colliding with the injected machinery", () => {
    // `events` / `pending_overrides` are the injected inner aliases; a user alias of
    // the same name must be rejected up front (covers the RESERVED branch the
    // `_v\\d+` test does not).
    expectTag(() => compile("SELECT count() AS n FROM events AS events"), "VoidQlUnsupportedError");
    expectTag(
      () => compile("SELECT count() AS n FROM events AS pending_overrides"),
      "VoidQlUnsupportedError",
    );
  });
});

describe("VoidQL compiler — parameter binding (no escaping class)", () => {
  it("binds adversarial string literals as parameters, not raw SQL", () => {
    const { sql, binds } = compile(
      "SELECT count() AS n FROM events WHERE event_name = ' OR 1=1 --'",
    );
    expect(sql).not.toContain("OR 1=1");
    expect(binds).toContain(" OR 1=1 --");
  });

  it("binds driver-substitution and backslash payloads as values", () => {
    const a = compile("SELECT count() AS n FROM events WHERE event_name = '%(x)s'");
    expect(a.binds).toContain("%(x)s");
    const b = compile("SELECT count() AS n FROM events WHERE event_name = 'a\\b'");
    expect(b.binds).toContain("a\\b");
  });
});
