import type {
  Action,
  ActionValueSource,
  ComponentActionValueSource,
  ComponentBoundAction,
  ComponentProductSource,
  ProductSource,
  VariableValue,
} from "./snapshot-types";
import type { VariableReader } from "./variables";

export interface ActionCallbacks {
  onClosePaywall: () => void;
  onPurchaseProduct: (productId: string) => void;
  onSetVariable: (variableId: string, newValue: VariableValue) => void;
}

function resolveActionValue(
  source: ActionValueSource,
  variables: VariableReader,
): VariableValue | undefined {
  if (!source?.type) {
    return undefined;
  }
  if (source.type === "literal") {
    return source.value as VariableValue;
  }
  if (!source.value || !("id" in source.value) || !source.value.id) {
    return undefined;
  }
  return variables.get(source.value.id);
}

function resolveProductId(source: ProductSource, variables: VariableReader): string | undefined {
  if (!source?.type) {
    return undefined;
  }
  if (source.type === "literal") {
    return source.productId;
  }
  if (!source.variableId) {
    return undefined;
  }
  const variable = variables.get(source.variableId);
  if (variable?.key === "product") {
    return variable.value?.productId;
  }
  return undefined;
}

/**
 * Executes a visual-node interaction action against the given variable lookup
 * (a plain store or an ancestor-chain reader) and host callbacks.
 */
export function executeAction(
  action: Action,
  variables: VariableReader,
  callbacks: ActionCallbacks,
): void {
  if (!action?.type) {
    return;
  }

  switch (action.type) {
    case "none":
      break;
    case "set-variable": {
      const payload = action.payload;
      if (!payload?.newValue || !payload.variableId) {
        break;
      }
      const newValue = resolveActionValue(payload.newValue, variables);
      if (newValue !== undefined) {
        callbacks.onSetVariable(payload.variableId, newValue);
      }
      break;
    }
    case "close-paywall":
      callbacks.onClosePaywall();
      break;
    case "purchase-product": {
      if (!action.payload) {
        break;
      }
      const productId = resolveProductId(action.payload, variables);
      if (productId !== undefined) {
        callbacks.onPurchaseProduct(productId);
      }
      break;
    }
  }
}

/**
 * Coerces a raw component action payload field to the type of the target
 * variable. Scalars must match the target's typeof exactly; a product
 * variable accepts any scalar field as `{ productId: String(value) }`
 * (spec §3.2). Returns `undefined` (skip) for anything else.
 */
function coercePayloadFieldToVariableValue(
  raw: unknown,
  target: VariableValue,
): VariableValue | undefined {
  switch (target.key) {
    case "string":
      return typeof raw === "string" ? { key: "string", value: raw } : undefined;
    case "number":
      return typeof raw === "number" ? { key: "number", value: raw } : undefined;
    case "boolean":
      return typeof raw === "boolean" ? { key: "boolean", value: raw } : undefined;
    case "product":
      return typeof raw === "string" || typeof raw === "number" || typeof raw === "boolean"
        ? { key: "product", value: { productId: String(raw) } }
        : undefined;
    default:
      return undefined;
  }
}

function resolveComponentActionValue(
  source: ComponentActionValueSource,
  payload: Record<string, unknown> | undefined,
  variables: VariableReader,
  targetVariableId: string,
): VariableValue | undefined {
  if (!source?.type) {
    return undefined;
  }
  if (source.type === "literal") {
    return source.value as VariableValue;
  }
  if (source.type === "variable-reference") {
    if (!source.value || !("id" in source.value) || !source.value.id) {
      return undefined;
    }
    return variables.get(source.value.id);
  }
  if (!source.value || !("field" in source.value) || !source.value.field) {
    return undefined;
  }
  const raw = payload?.[source.value.field];
  if (raw === undefined) {
    return undefined;
  }
  const target = variables.get(targetVariableId);
  if (target === undefined) {
    return undefined;
  }
  return coercePayloadFieldToVariableValue(raw, target);
}

function resolveComponentProductId(
  source: ComponentProductSource,
  payload: Record<string, unknown> | undefined,
  variables: VariableReader,
): string | undefined {
  if (!source?.type) {
    return undefined;
  }
  if (source.type === "literal") {
    return source.productId;
  }
  if (source.type === "variable-reference") {
    if (!source.variableId) {
      return undefined;
    }
    const variable = variables.get(source.variableId);
    if (variable?.key === "product") {
      return variable.value?.productId;
    }
    return undefined;
  }
  if (!source.field) {
    return undefined;
  }
  const raw = payload?.[source.field];
  return typeof raw === "string" ? raw : undefined;
}

/**
 * Executes a component bound action with the payload emitted by the component
 * action (if any). Literal and variable-reference sources behave like
 * {@link executeAction}; `action-payload` sources resolve `payload[field]`
 * and no-op when the field is absent. `set-variable` coerces payload-sourced
 * values to the target variable's type and skips on mismatch.
 */
export function executeComponentBoundAction(
  action: ComponentBoundAction,
  payload: Record<string, unknown> | undefined,
  variables: VariableReader,
  callbacks: ActionCallbacks,
): void {
  if (!action?.type) {
    return;
  }

  switch (action.type) {
    case "none":
      break;
    case "set-variable": {
      const actionPayload = action.payload;
      if (!actionPayload?.newValue || !actionPayload.variableId) {
        break;
      }
      const newValue = resolveComponentActionValue(
        actionPayload.newValue,
        payload,
        variables,
        actionPayload.variableId,
      );
      if (newValue !== undefined) {
        callbacks.onSetVariable(actionPayload.variableId, newValue);
      }
      break;
    }
    case "close-paywall":
      callbacks.onClosePaywall();
      break;
    case "purchase-product": {
      if (!action.payload) {
        break;
      }
      const productId = resolveComponentProductId(action.payload, payload, variables);
      if (productId !== undefined) {
        callbacks.onPurchaseProduct(productId);
      }
      break;
    }
  }
}
