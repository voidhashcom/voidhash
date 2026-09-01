import type {
  ComponentSnapshotNode,
  VariableReader,
} from "@voidhash/paywall-renderer-web-core";

type ComponentInstancePropEntries = ComponentSnapshotNode["data"]["props"];

/**
 * Resolves a `component` node's document `props` (the same `{name, value}`
 * bindings catalog/local instances carry) to plain values for a built-in
 * implementation. `literal` bindings unwrap their stored `ComponentPropValue`
 * payload; `variable-reference` bindings read the node's variable chain and
 * unwrap the current `VariableValue` payload (so a `product` value resolves to
 * its `{productId}` object). Unset names and unresolvable references are
 * omitted — builtins fall back to their manifest defaults.
 */
export function resolveComponentInstanceProps(
  props: ComponentInstancePropEntries,
  variables: VariableReader,
): Record<string, unknown> {
  return props.reduce<Record<string, unknown>>((resolved, entry) => {
    const prop = entry.value;
    if (!prop?.name) {
      return resolved;
    }
    const binding = prop.value;
    if (!binding?.type) {
      return resolved;
    }
    if (binding.type === "literal") {
      if (binding.value) {
        resolved[prop.name] = binding.value.value;
      }
      return resolved;
    }
    if (binding.type === "variable-reference") {
      if (!binding.value || !("id" in binding.value) || !binding.value.id) {
        return resolved;
      }
      const variable = variables.get(binding.value.id);
      if (variable !== undefined) {
        resolved[prop.name] = variable.value;
      }
    }
    return resolved;
  }, {});
}
