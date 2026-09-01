import * as Option from "effect/Option";
import * as P from "effect/Predicate";
import { assert } from "vite-plus/test";

/** Returns the value expected to be present in a test fixture. */
export function required<A>(value: Option.Option<A>): A {
  assert(Option.isSome(value));
  return value.value;
}

function isNodeOfType<T extends { readonly type: string }>(
  node: unknown,
  type: T["type"],
): node is T {
  return P.isObject(node) && "type" in node && node.type === type;
}

/** Narrows a decoded fixture node by its discriminator. */
export function narrowNode<T extends { readonly type: string }>(node: unknown, type: T["type"]): T {
  assert(isNodeOfType<T>(node, type));
  return node;
}
