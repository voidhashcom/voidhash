import { constant } from "@voidhash/lib/lang";
import { Effect } from "effect";

import { describe, expect, it } from "../../../src/testing/effect-vitest.ts";
import {
  type AnalyticsFilter,
  compileAnalyticsFilter,
  InvalidAnalyticsQueryError,
  UnsupportedAnalyticsFilterError,
} from "../../../src/domain/analytics/Analytics.ts";

/**
 * The compiler is a pure `Effect` so each assertion runs inside `it.effect`
 * (success path) or moves the typed error into the success channel with
 * `Effect.flip` (failure path), mirroring SecretBox.test.ts.
 */

// Every revenue field is supported in these tests unless a case narrows it.
const ALL_FIELDS = constant([
  "project.id",
  "product.id",
  "provider.environment",
  "subscription.status",
]);

// Fresh availableProjectIds list per test — never share mutable arrays.
const PROJECTS = () => ["proj_a", "proj_b", "proj_c"];

// Mirrors the `op` union of the predicate arm of AnalyticsFilter.
type PredicateOp = Extract<AnalyticsFilter, { type: "predicate" }>["op"];
type PredicateValue = Extract<AnalyticsFilter, { type: "predicate" }>["value"];

type CompileError = InvalidAnalyticsQueryError | UnsupportedAnalyticsFilterError;

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
  compileAnalyticsFilter({
    availableProjectIds,
    filter,
    supportedFields: ALL_FIELDS,
  });

const compileExpectError = (
  filter: AnalyticsFilter,
  options?: { supportedFields?: readonly string[] },
) =>
  compileAnalyticsFilter({
    availableProjectIds: PROJECTS(),
    filter,
    supportedFields: options?.supportedFields ?? ALL_FIELDS,
  }).pipe(Effect.flip);

/**
 * Asserts the failure is the unsupported-filter arm and narrows it, so the
 * arm-specific `field` can be read without a cast. The `expect` fails the test
 * before the narrowing is relied upon when the other arm is returned.
 */
function expectUnsupportedFilterError(
  error: CompileError,
): asserts error is UnsupportedAnalyticsFilterError {
  expect(error).toBeInstanceOf(UnsupportedAnalyticsFilterError);
}

describe("compileAnalyticsFilter", () => {
  it.effect("with no filter, defaults projectIds to all available projects", () =>
    Effect.gen(function* () {
      const result = yield* compile(undefined);
      expect(result.projectIds).toEqual(["proj_a", "proj_b", "proj_c"]);
      expect(result.productIds).toBeUndefined();
      expect(result.providerEnvironments).toBeUndefined();
      expect(result.subscriptionStatuses).toBeUndefined();
    }),
  );

  it.effect("project.id eq constrains to the matching available project", () =>
    Effect.gen(function* () {
      const result = yield* compile(predicate("project.id", "eq", "proj_b"));
      expect(result.projectIds).toEqual(["proj_b"]);
    }),
  );

  it.effect("project.id in constrains to multiple matching available projects", () =>
    Effect.gen(function* () {
      const result = yield* compile(predicate("project.id", "in", ["proj_a", "proj_c"]));
      expect(result.projectIds).toEqual(["proj_a", "proj_c"]);
    }),
  );

  it.effect("project.id neq excludes the matching project", () =>
    Effect.gen(function* () {
      const result = yield* compile(predicate("project.id", "neq", "proj_b"));
      expect(result.projectIds).toEqual(["proj_a", "proj_c"]);
    }),
  );

  it.effect("project.id not_in excludes multiple projects", () =>
    Effect.gen(function* () {
      const result = yield* compile(predicate("project.id", "not_in", ["proj_a", "proj_b"]));
      expect(result.projectIds).toEqual(["proj_c"]);
    }),
  );

  it.effect(
    "project.id eq for an unavailable id yields no projects (constrained to availableProjectIds)",
    () =>
      Effect.gen(function* () {
        const result = yield* compile(predicate("project.id", "eq", "proj_not_mine"));
        expect(result.projectIds).toEqual([]);
      }),
  );

  it.effect("product.id eq extracts the string value into productIds", () =>
    Effect.gen(function* () {
      const result = yield* compile(predicate("product.id", "eq", "prod_1"));
      expect(result.productIds).toEqual(["prod_1"]);
      // projectIds falls back to all available when not constrained.
      expect(result.projectIds).toEqual(["proj_a", "proj_b", "proj_c"]);
    }),
  );

  it.effect("product.id in extracts the string array into productIds", () =>
    Effect.gen(function* () {
      const result = yield* compile(predicate("product.id", "in", ["prod_1", "prod_2"]));
      expect(result.productIds).toEqual(["prod_1", "prod_2"]);
    }),
  );

  it.effect("provider.environment eq extracts the numeric value", () =>
    Effect.gen(function* () {
      const result = yield* compile(predicate("provider.environment", "eq", 1));
      expect(result.providerEnvironments).toEqual([1]);
    }),
  );

  it.effect("subscription.status eq extracts the numeric value", () =>
    Effect.gen(function* () {
      const result = yield* compile(predicate("subscription.status", "eq", 2));
      expect(result.subscriptionStatuses).toEqual([2]);
    }),
  );

  it.effect("AND of two predicates on the same field intersects their constraints", () =>
    Effect.gen(function* () {
      const result = yield* compile(
        and(
          predicate("project.id", "in", ["proj_a", "proj_b"]),
          predicate("project.id", "in", ["proj_b", "proj_c"]),
        ),
      );
      expect(result.projectIds).toEqual(["proj_b"]);
    }),
  );

  it.effect("AND of predicates on different fields keeps each field's constraint", () =>
    Effect.gen(function* () {
      const result = yield* compile(
        and(
          predicate("project.id", "eq", "proj_a"),
          predicate("product.id", "in", ["prod_1", "prod_2"]),
        ),
      );
      expect(result.projectIds).toEqual(["proj_a"]);
      expect(result.productIds).toEqual(["prod_1", "prod_2"]);
    }),
  );

  it.effect("OR of predicates on the same field unions their values", () =>
    Effect.gen(function* () {
      const result = yield* compile(
        or(predicate("product.id", "eq", "prod_1"), predicate("product.id", "eq", "prod_2")),
      );
      expect(result.productIds).toEqual(["prod_1", "prod_2"]);
    }),
  );

  it.effect("OR de-duplicates overlapping values within the same field", () =>
    Effect.gen(function* () {
      const result = yield* compile(
        or(
          predicate("product.id", "in", ["prod_1", "prod_2"]),
          predicate("product.id", "in", ["prod_2", "prod_3"]),
        ),
      );
      expect(result.productIds).toEqual(["prod_1", "prod_2", "prod_3"]);
    }),
  );

  it.effect(
    "OR of two single-field branches on different fields is accepted (each side has one field)",
    () =>
      Effect.gen(function* () {
        // The mixed-field guard only fires when ONE side of the OR already spans
        // two or more fields; two single-field branches each carry one field, so
        // the union is permitted and constraints land on their respective fields.
        const result = yield* compile(
          or(predicate("project.id", "eq", "proj_a"), predicate("product.id", "eq", "prod_1")),
        );
        expect(result.projectIds).toEqual(["proj_a"]);
        expect(result.productIds).toEqual(["prod_1"]);
      }),
  );

  it.effect("OR with a multi-field branch rejects with UnsupportedAnalyticsFilterError", () =>
    Effect.gen(function* () {
      // Nesting a two-field AND inside the OR makes one side span multiple fields,
      // which trips the single-field-only OR restriction.
      const error = yield* compileExpectError(
        or(
          and(predicate("project.id", "eq", "proj_a"), predicate("product.id", "eq", "prod_1")),
          predicate("product.id", "eq", "prod_2"),
        ),
      );
      expectUnsupportedFilterError(error);
      expect(error.field).toBe("or");
      expect(error.message).toContain("single field");
    }),
  );

  it.effect("NOT project.id(eq) inverts to neq (excludes the project)", () =>
    Effect.gen(function* () {
      const result = yield* compile(not(predicate("project.id", "eq", "proj_b")));
      expect(result.projectIds).toEqual(["proj_a", "proj_c"]);
    }),
  );

  it.effect("NOT project.id(in) inverts to not_in (excludes the listed projects)", () =>
    Effect.gen(function* () {
      const result = yield* compile(not(predicate("project.id", "in", ["proj_a", "proj_b"])));
      expect(result.projectIds).toEqual(["proj_c"]);
    }),
  );

  it.effect("NOT on a non-project.id field rejects with UnsupportedAnalyticsFilterError", () =>
    Effect.gen(function* () {
      const error = yield* compileExpectError(not(predicate("product.id", "eq", "prod_1")));
      expectUnsupportedFilterError(error);
      expect(error.field).toBe("not");
    }),
  );

  it.effect("NOT wrapping a non-predicate (and) rejects with UnsupportedAnalyticsFilterError", () =>
    Effect.gen(function* () {
      const error = yield* compileExpectError(not(and(predicate("project.id", "eq", "proj_a"))));
      expectUnsupportedFilterError(error);
      expect(error.field).toBe("not");
    }),
  );

  it.effect("an unknown field rejects with UnsupportedAnalyticsFilterError (not supported)", () =>
    Effect.gen(function* () {
      const error = yield* compileExpectError(predicate("totally.unknown", "eq", "x"));
      expectUnsupportedFilterError(error);
      expect(error.field).toBe("totally.unknown");
      expect(error.message).toContain("is not supported");
    }),
  );

  it.effect("a reserved field prefix rejects with the reserved-domain message", () =>
    Effect.gen(function* () {
      const error = yield* compileExpectError(predicate("event.name", "eq", "signup"));
      expectUnsupportedFilterError(error);
      expect(error.message).toContain("reserved for a future analytics domain");
    }),
  );

  it.effect(
    "a supported-by-registry field excluded from this insight rejects as not-supported-for-insight",
    () =>
      Effect.gen(function* () {
        const error = yield* compileExpectError(predicate("product.id", "eq", "prod_1"), {
          // product.id is a real revenue field but this insight only allows project.id.
          supportedFields: ["project.id"],
        });
        expectUnsupportedFilterError(error);
        expect(error.message).toContain("is not supported for this insight");
      }),
  );

  it.effect("a string value for a numeric field rejects with InvalidAnalyticsQueryError", () =>
    Effect.gen(function* () {
      const error = yield* compileExpectError(
        predicate("provider.environment", "eq", "not-a-number"),
      );
      expect(error).toBeInstanceOf(InvalidAnalyticsQueryError);
      expect(error.message).toContain("expects numeric values");
    }),
  );

  it.effect("a numeric value for a string field rejects with InvalidAnalyticsQueryError", () =>
    Effect.gen(function* () {
      const error = yield* compileExpectError(predicate("product.id", "eq", 42));
      expect(error).toBeInstanceOf(InvalidAnalyticsQueryError);
      expect(error.message).toContain("expects string values");
    }),
  );

  it.effect(
    "an unsupported operator (gt) on a supported field rejects with UnsupportedAnalyticsFilterError",
    () =>
      Effect.gen(function* () {
        const error = yield* compileExpectError(predicate("project.id", "gt", "proj_a"));
        expectUnsupportedFilterError(error);
        expect(error.field).toBe("project.id");
        expect(error.message).toContain("is not supported");
      }),
  );

  it.effect("compiles nested AND/OR structures recursively", () =>
    Effect.gen(function* () {
      const result = yield* compile(
        and(
          predicate("project.id", "in", ["proj_a", "proj_b"]),
          or(predicate("product.id", "eq", "prod_1"), predicate("product.id", "eq", "prod_2")),
        ),
      );
      expect(result.projectIds).toEqual(["proj_a", "proj_b"]);
      expect(result.productIds).toEqual(["prod_1", "prod_2"]);
    }),
  );
});
