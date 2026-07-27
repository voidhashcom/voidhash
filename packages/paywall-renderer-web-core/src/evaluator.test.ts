import { describe, expect, test } from "vite-plus/test";

import { evaluateDNF } from "./evaluator";
import type { Conjunction, DNF, Operand, Predicate, PredicateType } from "./snapshot-types";
import type { VariableStore } from "./variables";

function lit(key: "boolean", value: boolean): Operand;
function lit(key: "number", value: number): Operand;
function lit(key: "string", value: string): Operand;
function lit(key: string, value: unknown): Operand {
  return { type: "literal" as const, value: { key, value } } as Operand;
}

function varRef(id: string): Operand {
  return { type: "variable-reference", value: { id } };
}

function predicate(type: PredicateType, left: Operand, right: Operand): Predicate {
  return { type, value: { left, right } };
}

function and(...predicates: Predicate[]): Conjunction {
  return {
    type: "and",
    value: predicates.map((value, index) => ({
      id: `predicate-${index}`,
      pos: `a${index}`,
      value,
    })),
  };
}

function or(...conjunctions: Conjunction[]): DNF {
  return {
    type: "or",
    value: conjunctions.map((value, index) => ({
      id: `conjunction-${index}`,
      pos: `a${index}`,
      value,
    })),
  };
}

function orRaw(...conjunctions: Conjunction[]): DNF {
  return {
    type: "or",
    value: conjunctions as unknown as DNF["value"],
  };
}

describe("evaluateDNF", () => {
  describe("equals predicate", () => {
    test("true when both literals match", () => {
      const dnf = or(and(predicate("equals", lit("boolean", true), lit("boolean", true))));
      expect(evaluateDNF(dnf, new Map())).toBe(true);
    });

    test("false when literals differ", () => {
      const dnf = or(and(predicate("equals", lit("boolean", true), lit("boolean", false))));
      expect(evaluateDNF(dnf, new Map())).toBe(false);
    });

    test("compares numbers", () => {
      const dnf = or(and(predicate("equals", lit("number", 5), lit("number", 5))));
      expect(evaluateDNF(dnf, new Map())).toBe(true);
    });

    test("compares strings", () => {
      const dnf = or(and(predicate("equals", lit("string", "a"), lit("string", "b"))));
      expect(evaluateDNF(dnf, new Map())).toBe(false);
    });
  });

  describe("not-equals predicate", () => {
    test("true when values differ", () => {
      const dnf = or(and(predicate("not-equals", lit("number", 1), lit("number", 2))));
      expect(evaluateDNF(dnf, new Map())).toBe(true);
    });

    test("false when values match", () => {
      const dnf = or(and(predicate("not-equals", lit("number", 1), lit("number", 1))));
      expect(evaluateDNF(dnf, new Map())).toBe(false);
    });
  });

  describe("comparison predicates", () => {
    test("greater-than", () => {
      expect(
        evaluateDNF(
          or(and(predicate("greater-than", lit("number", 5), lit("number", 3)))),
          new Map(),
        ),
      ).toBe(true);
      expect(
        evaluateDNF(
          or(and(predicate("greater-than", lit("number", 3), lit("number", 5)))),
          new Map(),
        ),
      ).toBe(false);
      expect(
        evaluateDNF(
          or(and(predicate("greater-than", lit("number", 5), lit("number", 5)))),
          new Map(),
        ),
      ).toBe(false);
    });

    test("greater-than-or-equal", () => {
      expect(
        evaluateDNF(
          or(and(predicate("greater-than-or-equal", lit("number", 5), lit("number", 5)))),
          new Map(),
        ),
      ).toBe(true);
      expect(
        evaluateDNF(
          or(and(predicate("greater-than-or-equal", lit("number", 4), lit("number", 5)))),
          new Map(),
        ),
      ).toBe(false);
    });

    test("less-than", () => {
      expect(
        evaluateDNF(or(and(predicate("less-than", lit("number", 3), lit("number", 5)))), new Map()),
      ).toBe(true);
      expect(
        evaluateDNF(or(and(predicate("less-than", lit("number", 5), lit("number", 3)))), new Map()),
      ).toBe(false);
    });

    test("less-than-or-equal", () => {
      expect(
        evaluateDNF(
          or(and(predicate("less-than-or-equal", lit("number", 5), lit("number", 5)))),
          new Map(),
        ),
      ).toBe(true);
      expect(
        evaluateDNF(
          or(and(predicate("less-than-or-equal", lit("number", 6), lit("number", 5)))),
          new Map(),
        ),
      ).toBe(false);
    });
  });

  describe("variable references", () => {
    test("resolves variable reference from store", () => {
      const variables: VariableStore = new Map([["var-1", { key: "boolean", value: true }]]);
      const dnf = or(and(predicate("equals", varRef("var-1"), lit("boolean", true))));
      expect(evaluateDNF(dnf, variables)).toBe(true);
    });

    test("returns false for missing variable reference", () => {
      const dnf = or(and(predicate("equals", varRef("missing"), lit("boolean", true))));
      expect(evaluateDNF(dnf, new Map())).toBe(false);
    });

    test("compares two variable references", () => {
      const variables: VariableStore = new Map([
        ["var-1", { key: "number", value: 10 }],
        ["var-2", { key: "number", value: 10 }],
      ]);
      const dnf = or(and(predicate("equals", varRef("var-1"), varRef("var-2"))));
      expect(evaluateDNF(dnf, variables)).toBe(true);
    });
  });

  describe("conjunction (AND)", () => {
    test("all predicates must be true", () => {
      const dnf = or(
        and(
          predicate("equals", lit("boolean", true), lit("boolean", true)),
          predicate("equals", lit("number", 1), lit("number", 1)),
        ),
      );
      expect(evaluateDNF(dnf, new Map())).toBe(true);
    });

    test("fails if any predicate is false", () => {
      const dnf = or(
        and(
          predicate("equals", lit("boolean", true), lit("boolean", true)),
          predicate("equals", lit("number", 1), lit("number", 2)),
        ),
      );
      expect(evaluateDNF(dnf, new Map())).toBe(false);
    });
  });

  describe("DNF (OR of ANDs)", () => {
    test("true if any conjunction is true", () => {
      const dnf = or(
        and(predicate("equals", lit("boolean", true), lit("boolean", false))),
        and(predicate("equals", lit("number", 1), lit("number", 1))),
      );
      expect(evaluateDNF(dnf, new Map())).toBe(true);
    });

    test("false if all conjunctions are false", () => {
      const dnf = or(
        and(predicate("equals", lit("boolean", true), lit("boolean", false))),
        and(predicate("equals", lit("number", 1), lit("number", 2))),
      );
      expect(evaluateDNF(dnf, new Map())).toBe(false);
    });

    test("supports legacy payloads with plain (entry-less) conjunction/predicate arrays", () => {
      const dnf = orRaw({
        type: "and",
        value: [
          {
            type: "equals",
            value: {
              left: { type: "literal", value: { key: "boolean", value: true } },
              right: {
                type: "literal",
                value: { key: "boolean", value: true },
              },
            },
          },
        ] as unknown as Conjunction["value"],
      } as Conjunction);
      expect(evaluateDNF(dnf, new Map())).toBe(true);
    });
  });
});
