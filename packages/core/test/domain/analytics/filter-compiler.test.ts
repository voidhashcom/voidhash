import { describe, expect, it } from "vite-plus/test";
import { Effect } from "effect";

import {
  type AnalyticsFilter,
  compileAnalyticsFilter,
  InvalidAnalyticsQueryError,
  UnsupportedAnalyticsFilterError,
} from "../../../src/domain/analytics/Analytics.ts";

/**
 * The compiler is a pure `Effect` so each assertion runs the effect with
 * `Effect.runPromise` (success path) or moves the typed error into the success
 * channel with `Effect.flip` (failure path), mirroring SecretBox.test.ts.
 */

// Every revenue field is supported in these tests unless a case narrows it.
const ALL_FIELDS = [
  "project.id",
  "product.id",
  "provider.environment",
  "subscription.status",
] as const;

// Fresh availableProjectIds list per test — never share mutable arrays.
const PROJECTS = () => ["proj_a", "proj_b", "proj_c"];

// Mirrors the `op` union of the predicate arm of AnalyticsFilter.
type PredicateOp = Extract<AnalyticsFilter, { type: "predicate" }>["op"];
type PredicateValue = Extract<AnalyticsFilter, { type: "predicate" }>["value"];

const predicate = (field: string, op: PredicateOp, value?: PredicateValue): AnalyticsFilter => ({
  field,
  op,
  type: "predicate",
  value,
});

const and = (...filters: AnalyticsFilter[]): AnalyticsFilter => ({ filters, type: "and" });
const or = (...filters: AnalyticsFilter[]): AnalyticsFilter => ({ filters, type: "or" });
const not = (filter: AnalyticsFilter): AnalyticsFilter => ({ filter, type: "not" });

const compile = (filter: AnalyticsFilter | undefined, availableProjectIds = PROJECTS()) =>
  Effect.runPromise(
    compileAnalyticsFilter({
      availableProjectIds,
      filter,
      supportedFields: ALL_FIELDS,
    }),
  );

const compileExpectError = (
  filter: AnalyticsFilter,
  options?: { supportedFields?: readonly string[] },
) =>
  Effect.runPromise(
    compileAnalyticsFilter({
      availableProjectIds: PROJECTS(),
      filter,
      supportedFields: options?.supportedFields ?? ALL_FIELDS,
    }).pipe(Effect.flip),
  );

describe("compileAnalyticsFilter", () => {
  it("with no filter, defaults projectIds to all available projects", async () => {
    const result = await compile(undefined);
    expect(result.projectIds).toEqual(["proj_a", "proj_b", "proj_c"]);
    expect(result.productIds).toBeUndefined();
    expect(result.providerEnvironments).toBeUndefined();
    expect(result.subscriptionStatuses).toBeUndefined();
  });

  it("project.id eq constrains to the matching available project", async () => {
    const result = await compile(predicate("project.id", "eq", "proj_b"));
    expect(result.projectIds).toEqual(["proj_b"]);
  });

  it("project.id in constrains to multiple matching available projects", async () => {
    const result = await compile(predicate("project.id", "in", ["proj_a", "proj_c"]));
    expect(result.projectIds).toEqual(["proj_a", "proj_c"]);
  });

  it("project.id neq excludes the matching project", async () => {
    const result = await compile(predicate("project.id", "neq", "proj_b"));
    expect(result.projectIds).toEqual(["proj_a", "proj_c"]);
  });

  it("project.id not_in excludes multiple projects", async () => {
    const result = await compile(predicate("project.id", "not_in", ["proj_a", "proj_b"]));
    expect(result.projectIds).toEqual(["proj_c"]);
  });

  it("project.id eq for an unavailable id yields no projects (constrained to availableProjectIds)", async () => {
    const result = await compile(predicate("project.id", "eq", "proj_not_mine"));
    expect(result.projectIds).toEqual([]);
  });

  it("product.id eq extracts the string value into productIds", async () => {
    const result = await compile(predicate("product.id", "eq", "prod_1"));
    expect(result.productIds).toEqual(["prod_1"]);
    // projectIds falls back to all available when not constrained.
    expect(result.projectIds).toEqual(["proj_a", "proj_b", "proj_c"]);
  });

  it("product.id in extracts the string array into productIds", async () => {
    const result = await compile(predicate("product.id", "in", ["prod_1", "prod_2"]));
    expect(result.productIds).toEqual(["prod_1", "prod_2"]);
  });

  it("provider.environment eq extracts the numeric value", async () => {
    const result = await compile(predicate("provider.environment", "eq", 1));
    expect(result.providerEnvironments).toEqual([1]);
  });

  it("subscription.status eq extracts the numeric value", async () => {
    const result = await compile(predicate("subscription.status", "eq", 2));
    expect(result.subscriptionStatuses).toEqual([2]);
  });

  it("AND of two predicates on the same field intersects their constraints", async () => {
    const result = await compile(
      and(
        predicate("project.id", "in", ["proj_a", "proj_b"]),
        predicate("project.id", "in", ["proj_b", "proj_c"]),
      ),
    );
    expect(result.projectIds).toEqual(["proj_b"]);
  });

  it("AND of predicates on different fields keeps each field's constraint", async () => {
    const result = await compile(
      and(
        predicate("project.id", "eq", "proj_a"),
        predicate("product.id", "in", ["prod_1", "prod_2"]),
      ),
    );
    expect(result.projectIds).toEqual(["proj_a"]);
    expect(result.productIds).toEqual(["prod_1", "prod_2"]);
  });

  it("OR of predicates on the same field unions their values", async () => {
    const result = await compile(
      or(predicate("product.id", "eq", "prod_1"), predicate("product.id", "eq", "prod_2")),
    );
    expect(result.productIds).toEqual(["prod_1", "prod_2"]);
  });

  it("OR de-duplicates overlapping values within the same field", async () => {
    const result = await compile(
      or(
        predicate("product.id", "in", ["prod_1", "prod_2"]),
        predicate("product.id", "in", ["prod_2", "prod_3"]),
      ),
    );
    expect(result.productIds).toEqual(["prod_1", "prod_2", "prod_3"]);
  });

  it("OR of two single-field branches on different fields is accepted (each side has one field)", async () => {
    // The mixed-field guard only fires when ONE side of the OR already spans
    // two or more fields; two single-field branches each carry one field, so
    // the union is permitted and constraints land on their respective fields.
    const result = await compile(
      or(predicate("project.id", "eq", "proj_a"), predicate("product.id", "eq", "prod_1")),
    );
    expect(result.projectIds).toEqual(["proj_a"]);
    expect(result.productIds).toEqual(["prod_1"]);
  });

  it("OR with a multi-field branch rejects with UnsupportedAnalyticsFilterError", async () => {
    // Nesting a two-field AND inside the OR makes one side span multiple fields,
    // which trips the single-field-only OR restriction.
    const error = await compileExpectError(
      or(
        and(predicate("project.id", "eq", "proj_a"), predicate("product.id", "eq", "prod_1")),
        predicate("product.id", "eq", "prod_2"),
      ),
    );
    expect(error).toBeInstanceOf(UnsupportedAnalyticsFilterError);
    expect((error as UnsupportedAnalyticsFilterError).field).toBe("or");
    expect((error as UnsupportedAnalyticsFilterError).message).toContain("single field");
  });

  it("NOT project.id(eq) inverts to neq (excludes the project)", async () => {
    const result = await compile(not(predicate("project.id", "eq", "proj_b")));
    expect(result.projectIds).toEqual(["proj_a", "proj_c"]);
  });

  it("NOT project.id(in) inverts to not_in (excludes the listed projects)", async () => {
    const result = await compile(not(predicate("project.id", "in", ["proj_a", "proj_b"])));
    expect(result.projectIds).toEqual(["proj_c"]);
  });

  it("NOT on a non-project.id field rejects with UnsupportedAnalyticsFilterError", async () => {
    const error = await compileExpectError(not(predicate("product.id", "eq", "prod_1")));
    expect(error).toBeInstanceOf(UnsupportedAnalyticsFilterError);
    expect((error as UnsupportedAnalyticsFilterError).field).toBe("not");
  });

  it("NOT wrapping a non-predicate (and) rejects with UnsupportedAnalyticsFilterError", async () => {
    const error = await compileExpectError(not(and(predicate("project.id", "eq", "proj_a"))));
    expect(error).toBeInstanceOf(UnsupportedAnalyticsFilterError);
    expect((error as UnsupportedAnalyticsFilterError).field).toBe("not");
  });

  it("an unknown field rejects with UnsupportedAnalyticsFilterError (not supported)", async () => {
    const error = await compileExpectError(predicate("totally.unknown", "eq", "x"));
    expect(error).toBeInstanceOf(UnsupportedAnalyticsFilterError);
    expect((error as UnsupportedAnalyticsFilterError).field).toBe("totally.unknown");
    expect((error as UnsupportedAnalyticsFilterError).message).toContain("is not supported");
  });

  it("a reserved field prefix rejects with the reserved-domain message", async () => {
    const error = await compileExpectError(predicate("event.name", "eq", "signup"));
    expect(error).toBeInstanceOf(UnsupportedAnalyticsFilterError);
    expect((error as UnsupportedAnalyticsFilterError).message).toContain(
      "reserved for a future analytics domain",
    );
  });

  it("a supported-by-registry field excluded from this insight rejects as not-supported-for-insight", async () => {
    const error = await compileExpectError(predicate("product.id", "eq", "prod_1"), {
      // product.id is a real revenue field but this insight only allows project.id.
      supportedFields: ["project.id"],
    });
    expect(error).toBeInstanceOf(UnsupportedAnalyticsFilterError);
    expect((error as UnsupportedAnalyticsFilterError).message).toContain(
      "is not supported for this insight",
    );
  });

  it("a string value for a numeric field rejects with InvalidAnalyticsQueryError", async () => {
    const error = await compileExpectError(predicate("provider.environment", "eq", "not-a-number"));
    expect(error).toBeInstanceOf(InvalidAnalyticsQueryError);
    expect((error as InvalidAnalyticsQueryError).message).toContain("expects numeric values");
  });

  it("a numeric value for a string field rejects with InvalidAnalyticsQueryError", async () => {
    const error = await compileExpectError(predicate("product.id", "eq", 42));
    expect(error).toBeInstanceOf(InvalidAnalyticsQueryError);
    expect((error as InvalidAnalyticsQueryError).message).toContain("expects string values");
  });

  it("an unsupported operator (gt) on a supported field rejects with UnsupportedAnalyticsFilterError", async () => {
    const error = await compileExpectError(predicate("project.id", "gt", "proj_a"));
    expect(error).toBeInstanceOf(UnsupportedAnalyticsFilterError);
    expect((error as UnsupportedAnalyticsFilterError).field).toBe("project.id");
    expect((error as UnsupportedAnalyticsFilterError).message).toContain("is not supported");
  });

  it("compiles nested AND/OR structures recursively", async () => {
    const result = await compile(
      and(
        predicate("project.id", "in", ["proj_a", "proj_b"]),
        or(predicate("product.id", "eq", "prod_1"), predicate("product.id", "eq", "prod_2")),
      ),
    );
    expect(result.projectIds).toEqual(["proj_a", "proj_b"]);
    expect(result.productIds).toEqual(["prod_1", "prod_2"]);
  });
});
