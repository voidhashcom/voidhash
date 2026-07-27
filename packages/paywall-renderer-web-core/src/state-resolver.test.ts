import { describe, expect, test } from "vite-plus/test";

import type { Action, DNF, NodeState } from "./snapshot-types";
import { resolveActionOverride, resolveStyle } from "./state-resolver";
import type { VariableStore } from "./variables";

function makeDNF(literal: boolean): DNF {
  return {
    type: "or",
    value: [
      {
        id: "conjunction-1",
        pos: "a0",
        value: {
          type: "and" as const,
          value: [
            {
              id: "predicate-1",
              pos: "a0",
              value: {
                type: "equals" as const,
                value: {
                  left: {
                    type: "literal" as const,
                    value: { key: "boolean" as const, value: true },
                  },
                  right: {
                    type: "literal" as const,
                    value: { key: "boolean" as const, value: literal },
                  },
                },
              },
            },
          ],
        },
      },
    ],
  };
}

const alwaysTrue = makeDNF(true);
const alwaysFalse = makeDNF(false);

function variableEquals(variableId: string, value: boolean): DNF {
  return {
    type: "or",
    value: [
      {
        id: "conjunction-1",
        pos: "a0",
        value: {
          type: "and" as const,
          value: [
            {
              id: "predicate-1",
              pos: "a0",
              value: {
                type: "equals" as const,
                value: {
                  left: {
                    type: "variable-reference" as const,
                    value: { id: variableId },
                  },
                  right: {
                    type: "literal" as const,
                    value: { key: "boolean" as const, value },
                  },
                },
              },
            },
          ],
        },
      },
    ],
  };
}

function variableEqualsRaw(variableId: string, value: boolean): DNF {
  return {
    type: "or",
    value: [
      {
        type: "and",
        value: [
          {
            type: "equals",
            value: {
              left: {
                type: "variable-reference",
                value: { id: variableId },
              },
              right: {
                type: "literal",
                value: { key: "boolean", value },
              },
            },
          },
        ],
      },
    ] as unknown as DNF["value"],
  };
}

function state(
  condition: DNF,
  styleOverrides: Record<string, unknown>,
  actionOverrides?: Array<{ interactionId: string; action: Action }>,
): { value: NodeState } {
  return {
    value: {
      condition,
      id: "state-1",
      name: "State",
      overrides: {
        style: styleOverrides,
        ...(actionOverrides ? { actions: actionOverrides } : {}),
      },
    } as unknown as NodeState,
  };
}

describe("resolveStyle", () => {
  const baseStyle = { backgroundColor: "red", opacity: 1, width: 100 };
  const emptyVars: VariableStore = new Map();

  test("returns base style when no states", () => {
    const result = resolveStyle(baseStyle, [], emptyVars);
    expect(result).toEqual(baseStyle);
  });

  test("returns base style when state condition is false", () => {
    const result = resolveStyle(
      baseStyle,
      [state(alwaysFalse, { backgroundColor: "blue" })],
      emptyVars,
    );
    expect(result).toEqual(baseStyle);
  });

  test("merges active state style overrides", () => {
    const result = resolveStyle(
      baseStyle,
      [state(alwaysTrue, { backgroundColor: "blue" })],
      emptyVars,
    );
    expect(result).toEqual({ backgroundColor: "blue", opacity: 1, width: 100 });
  });

  test("last active state wins for conflicting properties", () => {
    const result = resolveStyle(
      baseStyle,
      [
        state(alwaysTrue, { backgroundColor: "blue" }),
        state(alwaysTrue, { backgroundColor: "green" }),
      ],
      emptyVars,
    );
    expect(result).toEqual({
      backgroundColor: "green",
      opacity: 1,
      width: 100,
    });
  });

  test("merges non-conflicting properties from multiple states", () => {
    const result = resolveStyle(
      baseStyle,
      [state(alwaysTrue, { backgroundColor: "blue" }), state(alwaysTrue, { opacity: 0.5 })],
      emptyVars,
    );
    expect(result).toEqual({
      backgroundColor: "blue",
      opacity: 0.5,
      width: 100,
    });
  });

  test("evaluates state condition using variable store", () => {
    const variables: VariableStore = new Map([["var-1", { key: "boolean", value: true }]]);

    const result = resolveStyle(
      baseStyle,
      [state(variableEquals("var-1", true), { width: 200 })],
      variables,
    );
    expect(result.width).toBe(200);
  });

  test("skips state when variable condition is false", () => {
    const variables: VariableStore = new Map([["var-1", { key: "boolean", value: false }]]);

    const result = resolveStyle(
      baseStyle,
      [state(variableEquals("var-1", true), { width: 200 })],
      variables,
    );
    expect(result.width).toBe(100);
  });

  test("ignores undefined override values", () => {
    const result = resolveStyle(
      baseStyle,
      [state(alwaysTrue, { backgroundColor: undefined })],
      emptyVars,
    );
    expect(result.backgroundColor).toBe("red");
  });

  test("replaces a structured background object wholesale (no deep merge)", () => {
    const structuredBase = {
      backgroundType: "gradient",
      backgroundGradient: {
        kind: "linear",
        startX: 0,
        startY: 0,
        endX: 1,
        endY: 1,
        stops: [{ value: { color: "rgba(0, 0, 0, 1)", position: 0 } }],
      },
    };
    const overrideGradient = {
      kind: "radial",
      startX: 0.5,
      startY: 0.5,
      endX: 1,
      endY: 1,
      stops: [{ value: { color: "rgba(255, 0, 0, 1)", position: 1 } }],
    };
    const result = resolveStyle(
      structuredBase,
      [state(alwaysTrue, { backgroundGradient: overrideGradient })],
      emptyVars,
    );
    // The whole gradient object is swapped for the override, not merged
    // key-by-key — the intended per-key replacement semantic.
    expect(result.backgroundGradient).toBe(overrideGradient);
    expect(result.backgroundType).toBe("gradient");
  });
});

describe("resolveActionOverride", () => {
  const emptyVars: VariableStore = new Map();
  const closeAction: Action = { type: "close-paywall" };
  const noneAction: Action = { type: "none" };

  test("returns undefined when no states", () => {
    expect(resolveActionOverride("int-1", [], emptyVars)).toBeUndefined();
  });

  test("returns undefined when no active states", () => {
    const states = [state(alwaysFalse, {}, [{ interactionId: "int-1", action: closeAction }])];
    expect(resolveActionOverride("int-1", states, emptyVars)).toBeUndefined();
  });

  test("returns overridden action for matching interaction", () => {
    const states = [state(alwaysTrue, {}, [{ interactionId: "int-1", action: closeAction }])];
    expect(resolveActionOverride("int-1", states, emptyVars)).toEqual(closeAction);
  });

  test("returns undefined for non-matching interaction id", () => {
    const states = [state(alwaysTrue, {}, [{ interactionId: "int-1", action: closeAction }])];
    expect(resolveActionOverride("int-2", states, emptyVars)).toBeUndefined();
  });

  test("last active state override wins", () => {
    const states = [
      state(alwaysTrue, {}, [{ interactionId: "int-1", action: closeAction }]),
      state(alwaysTrue, {}, [{ interactionId: "int-1", action: noneAction }]),
    ];
    expect(resolveActionOverride("int-1", states, emptyVars)).toEqual(noneAction);
  });

  test("toggle scenario: override found only when variable condition is true", () => {
    const setFalseAction: Action = {
      type: "set-variable",
      payload: {
        variableId: "var-isSelected",
        newValue: { type: "literal", value: { key: "boolean", value: false } },
      },
    };

    const states = [
      state(variableEquals("var-isSelected", true), { backgroundColor: "blue" }, [
        { interactionId: "int-click", action: setFalseAction },
      ]),
    ];

    // First click: isSelected = false -> condition false -> no override.
    const varsBeforeClick: VariableStore = new Map([
      ["var-isSelected", { key: "boolean", value: false }],
    ]);
    expect(resolveActionOverride("int-click", states, varsBeforeClick)).toBeUndefined();

    // After first click: isSelected = true -> condition true -> override found.
    const varsAfterFirstClick: VariableStore = new Map([
      ["var-isSelected", { key: "boolean", value: true }],
    ]);
    const override = resolveActionOverride("int-click", states, varsAfterFirstClick);
    expect(override).toEqual(setFalseAction);
  });

  test("supports real snapshot action override entries", () => {
    const close: Action = { type: "close-paywall" };
    const states = [
      {
        value: {
          id: "state-1",
          name: "Selected",
          condition: variableEqualsRaw("entry-isSelected", true),
          overrides: {
            style: {},
            actions: [
              {
                id: "entry-1",
                pos: "a0",
                value: {
                  interactionId: "interaction-1",
                  action: close,
                },
              },
            ],
          },
        },
      } as unknown as { value: NodeState },
    ];

    const variables: VariableStore = new Map([
      ["entry-isSelected", { key: "boolean", value: true }],
    ]);
    expect(resolveActionOverride("interaction-1", states, variables)).toEqual(close);
  });
});
