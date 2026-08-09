/**
 * The value-level isolation verifier (§10) — the **sole in-process fail-closed
 * net** now that the out-of-process row policy is gone (§20). It walks the
 * compiled {@link SqlPiece} IR, rendering `(sql, binds)` jointly, and hard-fails
 * the request (a {@link VoidQlIsolationError} defect that never reaches ClickHouse)
 * unless every invariant holds.
 *
 * Crucially it does NOT trust the printer's self-reported scopes alone: it
 * **triangulates** the printer-reported base-ref count against the physical-table
 * tokens it independently finds in the emitted SQL *and* the tenant-predicate
 * occurrences in that SQL. A printer bug that emits a base table without injecting
 * a scope therefore fails closed here rather than leaking.
 *
 * Because this is the only net, its per-occurrence enumeration must grow in
 * lock-step with every newly enabled construct (UNION arms, lambdas, windows) —
 * a blind spot is a direct leak, not a caught one (§11 G1, §20).
 */
import { Effect } from "effect";

import type { InjectedScope } from "./catalog/types.ts";
import { VoidQlIsolationError } from "./errors.ts";
import { renderDebugSql, type SqlPiece } from "./ir.ts";
import type { AuthorizedScope } from "./scope.ts";

/** Physical tables VoidQL is permitted to reference — all only inside a `lower()`. */
const ALLOWED_PHYSICAL_TABLES = new Set([
  "events_v2",
  "persons_v1",
  "person_identity_pending_overrides_v2",
]);

/** Tokens that must never appear in compiled VoidQL — the catalog/registry already
 * exclude them; this scan is the independent backstop (T3/T4/T5/T8). */
const FORBIDDEN_TOKEN_RE =
  /\b(remote|remoteSecure|url|s3|s3Cluster|file|mysql|postgresql|jdbc|odbc|hdfs|azureBlobStorage|mongodb|cluster|clusterAllReplicas|numbers|generateRandom|dictGet\w*|dictHas|getSetting|currentUser|hostName|serverUUID|getMacro|addressToLine|demangle|evalMLMethod|sleep|sleepEachRow|throwIf)\s*\(/i;

const VERSIONED_TABLE_RE = /\b\w+_v\d+\b/g;

const countOccurrences = (haystack: string, needle: string): number =>
  haystack.split(needle).length - 1;

const arrayEqual = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && a.every((v, i) => v === b[i]);

const fail = (message: string): never =>
  // `Effect.runSync` on a died effect rethrows the defect verbatim, so callers
  // still observe the tagged `VoidQlIsolationError` itself.
  Effect.runSync(Effect.die(new VoidQlIsolationError({ message: `isolation verifier: ${message}` })));

/**
 * Verify the compiled IR against the authorized scope. Throws
 * {@link VoidQlIsolationError} (a compiler defect) on any violation.
 */
export const verify = (
  pieces: readonly SqlPiece[],
  injected: readonly InjectedScope[],
  scope: AuthorizedScope,
): void => {
  const { sql } = renderDebugSql(pieces);

  // ── I1: every injected scope binds to the authorized org and exactly its projects.
  for (const scoped of injected) {
    if (scoped.orgValue !== scope.organizationId) {
      fail(`base-ref '${scoped.alias}' bound to a non-authorized organization`);
    }
    if (!arrayEqual(scoped.projectValues, scope.availableProjectIds)) {
      fail(`base-ref '${scoped.alias}' bound to the wrong project set`);
    }
  }

  // ── Triangulation: printer-reported base-refs vs physical tables vs predicates.
  // An `events`/`revenue` lowering scopes TWO physical reads — the dedup scan of
  // `events_v2` AND the identity-join scan of `person_identity_pending_overrides_v2`
  // (the latter has no row policy under the analytics_query user, so it is scoped
  // inline, §9/§20). A `persons` lowering scopes ONE (`persons_v1`). So each
  // event-backed scope contributes 2 tenant predicates and 1 of each physical
  // table; each person-backed scope contributes 1 predicate and 1 `persons_v1`.
  const eventBacked = injected.filter(
    (s) => s.relation === "events" || s.relation === "revenue",
  ).length;
  const personBacked = injected.filter((s) => s.relation === "persons").length;
  const expectedPredicates = eventBacked * 2 + personBacked;

  if (countOccurrences(sql, "events_v2") !== eventBacked) {
    fail("events_v2 occurrence count does not match injected event scopes");
  }
  if (countOccurrences(sql, "person_identity_pending_overrides_v2") !== eventBacked) {
    fail("pending-overrides occurrence count does not match injected event scopes");
  }
  if (countOccurrences(sql, "persons_v1") !== personBacked) {
    fail("persons_v1 occurrence count does not match injected person scopes");
  }
  if (countOccurrences(sql, "organization_id = {p") !== expectedPredicates) {
    fail("organization_id predicate count does not match scoped physical-read count");
  }
  if (countOccurrences(sql, "project_id IN {p") !== expectedPredicates) {
    fail("project_id predicate count does not match scoped physical-read count");
  }

  // ── I2: only the allow-listed physical tables appear; no table fns / introspection.
  for (const match of sql.matchAll(VERSIONED_TABLE_RE)) {
    if (!ALLOWED_PHYSICAL_TABLES.has(match[0])) {
      fail(`unexpected physical table token '${match[0]}'`);
    }
  }
  if (/\bsystem\./i.test(sql)) fail("reference to a system table");
  const forbidden = FORBIDDEN_TOKEN_RE.exec(sql);
  if (forbidden) fail(`forbidden function/table-function '${forbidden[1]}'`);

  // ── I3: no SETTINGS/SET/FORMAT in the emitted statement.
  if (/\bSETTINGS\b/i.test(sql) || /\bFORMAT\b/i.test(sql)) {
    fail("emitted statement contains a SETTINGS/FORMAT clause");
  }
};
