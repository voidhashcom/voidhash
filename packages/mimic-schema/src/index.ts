import type { Primitive } from "@voidhash/mimic-core";

/** Ordered-array entry (`{id, pos, value}`) re-exported under the legacy name. */
export type ArrayEntry<T> = Primitive.ArrayEntrySnapshot<T>;

export * from "./component-bindings/index.ts";
export * from "./document.ts";
export * from "./interactions/index.ts";
export * from "./locales/index.ts";
export * from "./nodes/index.ts";
export * from "./presence.ts";
export * from "./reconcile/index.ts";
export * from "./states/index.ts";
export * from "./styles/index.ts";
export * from "./utils/svg-parser.ts";
export * from "./variables/index.ts";
