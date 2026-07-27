import { describe, expect, it } from "vite-plus/test";

import { buildResolvedEventsSql } from "./resolved-events-sql.ts";

describe("buildResolvedEventsSql", () => {
  it("falls back to raw event columns when there is no pending override", () => {
    const sql = buildResolvedEventsSql();

    expect(sql.effectivePersonIdExpression).toBe(
      "coalesce(pending_overrides.person_id, events.person_id)",
    );
    expect(sql.effectiveDistinctIdExpression).toBe(
      "coalesce(pending_overrides.target_distinct_id, events.distinct_id)",
    );
    expect(sql.fromClause).toContain("FROM events_v2 AS events");
  });

  it("prefers pending override person ids for unsquashed events", () => {
    const sql = buildResolvedEventsSql({
      eventsAlias: "raw_events",
      overridesAlias: "overrides",
    });

    expect(sql.effectivePersonIdExpression).toBe(
      "coalesce(overrides.person_id, raw_events.person_id)",
    );
    expect(sql.leftJoinClause).toContain(
      "AND overrides.source_distinct_id = raw_events.distinct_id",
    );
  });

  it("exposes a canonical distinct id without rewriting the raw event id", () => {
    const sql = buildResolvedEventsSql();

    expect(sql.effectiveDistinctIdExpression).toBe(
      "coalesce(pending_overrides.target_distinct_id, events.distinct_id)",
    );
    expect(sql.leftJoinClause).toContain("target_distinct_id");
  });

  it("resolves only the latest version per raw distinct id", () => {
    const sql = buildResolvedEventsSql();

    expect(sql.leftJoinClause).toContain("LIMIT 1 BY project_id, source_distinct_id");
    expect(sql.leftJoinClause).toContain("version DESC");
    expect(sql.leftJoinClause).toContain("changed_at DESC");
  });

  it("excludes latest tombstones from query-time resolution", () => {
    const sql = buildResolvedEventsSql();

    expect(sql.leftJoinClause).toContain("WHERE is_deleted = 0");
  });
});
