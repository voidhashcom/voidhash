import { describe, expect, test, vi } from "vite-plus/test";

import { type ActionCallbacks, executeAction, executeComponentBoundAction } from "./actions";
import type { Action, ComponentBoundAction } from "./snapshot-types";
import type { VariableStore } from "./variables";

function makeCallbacks(): ActionCallbacks & {
  closePaywall: ReturnType<typeof vi.fn>;
  purchaseProduct: ReturnType<typeof vi.fn>;
  setVariable: ReturnType<typeof vi.fn>;
} {
  const closePaywall = vi.fn();
  const purchaseProduct = vi.fn();
  const setVariable = vi.fn();
  return {
    onClosePaywall: closePaywall,
    onPurchaseProduct: purchaseProduct,
    onSetVariable: setVariable,
    closePaywall,
    purchaseProduct,
    setVariable,
  };
}

describe("executeAction", () => {
  const emptyVars: VariableStore = new Map();

  test("none action does nothing", () => {
    const cbs = makeCallbacks();
    const action: Action = { type: "none" };
    executeAction(action, emptyVars, cbs);
    expect(cbs.closePaywall).not.toHaveBeenCalled();
    expect(cbs.purchaseProduct).not.toHaveBeenCalled();
    expect(cbs.setVariable).not.toHaveBeenCalled();
  });

  test("close-paywall calls onClosePaywall", () => {
    const cbs = makeCallbacks();
    const action: Action = { type: "close-paywall" };
    executeAction(action, emptyVars, cbs);
    expect(cbs.closePaywall).toHaveBeenCalledOnce();
  });

  test("set-variable with literal value", () => {
    const cbs = makeCallbacks();
    const action: Action = {
      type: "set-variable",
      payload: {
        variableId: "var-1",
        newValue: {
          type: "literal",
          value: { key: "boolean", value: true },
        },
      },
    };
    executeAction(action, emptyVars, cbs);
    expect(cbs.setVariable).toHaveBeenCalledWith("var-1", {
      key: "boolean",
      value: true,
    });
  });

  test("set-variable with variable reference", () => {
    const cbs = makeCallbacks();
    const variables: VariableStore = new Map([["source-var", { key: "number", value: 42 }]]);
    const action: Action = {
      type: "set-variable",
      payload: {
        variableId: "target-var",
        newValue: {
          type: "variable-reference",
          value: { id: "source-var" },
        },
      },
    };
    executeAction(action, variables, cbs);
    expect(cbs.setVariable).toHaveBeenCalledWith("target-var", {
      key: "number",
      value: 42,
    });
  });

  test("set-variable with missing reference does nothing", () => {
    const cbs = makeCallbacks();
    const action: Action = {
      type: "set-variable",
      payload: {
        variableId: "target-var",
        newValue: {
          type: "variable-reference",
          value: { id: "missing" },
        },
      },
    };
    executeAction(action, emptyVars, cbs);
    expect(cbs.setVariable).not.toHaveBeenCalled();
  });

  test("purchase-product with literal product id", () => {
    const cbs = makeCallbacks();
    const action: Action = {
      type: "purchase-product",
      payload: {
        type: "literal",
        productId: "product-123",
      },
    };
    executeAction(action, emptyVars, cbs);
    expect(cbs.purchaseProduct).toHaveBeenCalledWith("product-123");
  });

  test("purchase-product with variable reference", () => {
    const cbs = makeCallbacks();
    const variables: VariableStore = new Map([
      ["product-var", { key: "product", value: { productId: "product-456" } }],
    ]);
    const action: Action = {
      type: "purchase-product",
      payload: {
        type: "variable-reference",
        variableId: "product-var",
      },
    };
    executeAction(action, variables, cbs);
    expect(cbs.purchaseProduct).toHaveBeenCalledWith("product-456");
  });

  test("purchase-product with missing variable reference does nothing", () => {
    const cbs = makeCallbacks();
    const action: Action = {
      type: "purchase-product",
      payload: {
        type: "variable-reference",
        variableId: "missing",
      },
    };
    executeAction(action, emptyVars, cbs);
    expect(cbs.purchaseProduct).not.toHaveBeenCalled();
  });

  test("purchase-product with an unset product variable (absent productId) does nothing", () => {
    const cbs = makeCallbacks();
    const variables: VariableStore = new Map([["product-var", { key: "product", value: {} }]]);
    const action: Action = {
      type: "purchase-product",
      payload: {
        type: "variable-reference",
        variableId: "product-var",
      },
    };
    executeAction(action, variables, cbs);
    expect(cbs.purchaseProduct).not.toHaveBeenCalled();
  });

  test("purchase-product with a literal source without productId does nothing", () => {
    const cbs = makeCallbacks();
    const legacyAction = {
      type: "purchase-product",
      payload: { type: "literal" },
    } as unknown as Action;
    executeAction(legacyAction, emptyVars, cbs);
    expect(cbs.purchaseProduct).not.toHaveBeenCalled();
  });
});

describe("executeComponentBoundAction", () => {
  const emptyVars: VariableStore = new Map();

  function setVariableAction(
    newValue: NonNullable<
      Extract<ComponentBoundAction, { type: "set-variable" }>["payload"]
    >["newValue"],
    variableId = "target-var",
  ): ComponentBoundAction {
    return { type: "set-variable", payload: { newValue, variableId } };
  }

  test("none action does nothing", () => {
    const cbs = makeCallbacks();
    executeComponentBoundAction({ type: "none" }, { productId: "p" }, emptyVars, cbs);
    expect(cbs.closePaywall).not.toHaveBeenCalled();
    expect(cbs.purchaseProduct).not.toHaveBeenCalled();
    expect(cbs.setVariable).not.toHaveBeenCalled();
  });

  test("close-paywall calls onClosePaywall", () => {
    const cbs = makeCallbacks();
    executeComponentBoundAction({ type: "close-paywall" }, undefined, emptyVars, cbs);
    expect(cbs.closePaywall).toHaveBeenCalledOnce();
  });

  test("set-variable with literal value behaves like executeAction", () => {
    const cbs = makeCallbacks();
    const action = setVariableAction({
      type: "literal",
      value: { key: "boolean", value: true },
    });
    executeComponentBoundAction(action, undefined, emptyVars, cbs);
    expect(cbs.setVariable).toHaveBeenCalledWith("target-var", { key: "boolean", value: true });
  });

  test("set-variable with variable reference resolves through the reader", () => {
    const cbs = makeCallbacks();
    const variables: VariableStore = new Map([["source-var", { key: "number", value: 42 }]]);
    const action = setVariableAction({ type: "variable-reference", value: { id: "source-var" } });
    executeComponentBoundAction(action, undefined, variables, cbs);
    expect(cbs.setVariable).toHaveBeenCalledWith("target-var", { key: "number", value: 42 });
  });

  test("set-variable with missing variable reference does nothing", () => {
    const cbs = makeCallbacks();
    const action = setVariableAction({ type: "variable-reference", value: { id: "missing" } });
    executeComponentBoundAction(action, undefined, emptyVars, cbs);
    expect(cbs.setVariable).not.toHaveBeenCalled();
  });

  test("set-variable from payload field matching the target scalar type", () => {
    const cbs = makeCallbacks();
    const variables: VariableStore = new Map([["target-var", { key: "string", value: "old" }]]);
    const action = setVariableAction({ type: "action-payload", value: { field: "label" } });
    executeComponentBoundAction(action, { label: "new" }, variables, cbs);
    expect(cbs.setVariable).toHaveBeenCalledWith("target-var", { key: "string", value: "new" });
  });

  test("set-variable from payload field coerces scalars into a product variable", () => {
    const cbs = makeCallbacks();
    // Absent productId is the unset state (the former null).
    const variables: VariableStore = new Map([["target-var", { key: "product", value: {} }]]);
    const action = setVariableAction({ type: "action-payload", value: { field: "productId" } });
    executeComponentBoundAction(action, { productId: "yearly" }, variables, cbs);
    expect(cbs.setVariable).toHaveBeenCalledWith("target-var", {
      key: "product",
      value: { productId: "yearly" },
    });
    executeComponentBoundAction(action, { productId: 42 }, variables, cbs);
    expect(cbs.setVariable).toHaveBeenCalledWith("target-var", {
      key: "product",
      value: { productId: "42" },
    });
    executeComponentBoundAction(action, { productId: true }, variables, cbs);
    expect(cbs.setVariable).toHaveBeenCalledWith("target-var", {
      key: "product",
      value: { productId: "true" },
    });
    executeComponentBoundAction(action, { productId: { nested: true } }, variables, cbs);
    executeComponentBoundAction(action, {}, variables, cbs);
    expect(cbs.setVariable).toHaveBeenCalledTimes(3);
  });

  test("set-variable from payload field skips on type mismatch", () => {
    const cbs = makeCallbacks();
    const variables: VariableStore = new Map([["target-var", { key: "number", value: 1 }]]);
    const action = setVariableAction({ type: "action-payload", value: { field: "label" } });
    executeComponentBoundAction(action, { label: "not-a-number" }, variables, cbs);
    expect(cbs.setVariable).not.toHaveBeenCalled();
  });

  test("set-variable from payload field skips when the field is absent", () => {
    const cbs = makeCallbacks();
    const variables: VariableStore = new Map([["target-var", { key: "string", value: "old" }]]);
    const action = setVariableAction({ type: "action-payload", value: { field: "missing" } });
    executeComponentBoundAction(action, { label: "new" }, variables, cbs);
    executeComponentBoundAction(action, undefined, variables, cbs);
    expect(cbs.setVariable).not.toHaveBeenCalled();
  });

  test("set-variable from payload field skips when the target variable is unknown", () => {
    const cbs = makeCallbacks();
    const action = setVariableAction({ type: "action-payload", value: { field: "label" } });
    executeComponentBoundAction(action, { label: "new" }, emptyVars, cbs);
    expect(cbs.setVariable).not.toHaveBeenCalled();
  });

  test("set-variable boolean and number payload fields pass when typeof matches", () => {
    const cbs = makeCallbacks();
    const variables: VariableStore = new Map([
      ["bool-var", { key: "boolean", value: false }],
      ["num-var", { key: "number", value: 0 }],
    ]);
    executeComponentBoundAction(
      setVariableAction({ type: "action-payload", value: { field: "flag" } }, "bool-var"),
      { flag: true },
      variables,
      cbs,
    );
    executeComponentBoundAction(
      setVariableAction({ type: "action-payload", value: { field: "count" } }, "num-var"),
      { count: 7 },
      variables,
      cbs,
    );
    expect(cbs.setVariable).toHaveBeenCalledWith("bool-var", { key: "boolean", value: true });
    expect(cbs.setVariable).toHaveBeenCalledWith("num-var", { key: "number", value: 7 });
  });

  test("purchase-product with literal product id", () => {
    const cbs = makeCallbacks();
    const action: ComponentBoundAction = {
      type: "purchase-product",
      payload: { type: "literal", productId: "product-123" },
    };
    executeComponentBoundAction(action, undefined, emptyVars, cbs);
    expect(cbs.purchaseProduct).toHaveBeenCalledWith("product-123");
  });

  test("purchase-product with product variable reference", () => {
    const cbs = makeCallbacks();
    const variables: VariableStore = new Map([
      ["product-var", { key: "product", value: { productId: "product-456" } }],
    ]);
    const action: ComponentBoundAction = {
      type: "purchase-product",
      payload: { type: "variable-reference", variableId: "product-var" },
    };
    executeComponentBoundAction(action, undefined, variables, cbs);
    expect(cbs.purchaseProduct).toHaveBeenCalledWith("product-456");
  });

  test("purchase-product with an unset product variable (absent productId) does nothing", () => {
    const cbs = makeCallbacks();
    const variables: VariableStore = new Map([["product-var", { key: "product", value: {} }]]);
    const action: ComponentBoundAction = {
      type: "purchase-product",
      payload: { type: "variable-reference", variableId: "product-var" },
    };
    executeComponentBoundAction(action, undefined, variables, cbs);
    expect(cbs.purchaseProduct).not.toHaveBeenCalled();
  });

  test("purchase-product from payload field", () => {
    const cbs = makeCallbacks();
    const action: ComponentBoundAction = {
      type: "purchase-product",
      payload: { type: "action-payload", field: "productId" },
    };
    executeComponentBoundAction(action, { productId: "yearly" }, emptyVars, cbs);
    expect(cbs.purchaseProduct).toHaveBeenCalledWith("yearly");
  });

  test("purchase-product from payload field skips non-string or absent values", () => {
    const cbs = makeCallbacks();
    const action: ComponentBoundAction = {
      type: "purchase-product",
      payload: { type: "action-payload", field: "productId" },
    };
    executeComponentBoundAction(action, { productId: 42 }, emptyVars, cbs);
    executeComponentBoundAction(action, {}, emptyVars, cbs);
    executeComponentBoundAction(action, undefined, emptyVars, cbs);
    expect(cbs.purchaseProduct).not.toHaveBeenCalled();
  });
});
