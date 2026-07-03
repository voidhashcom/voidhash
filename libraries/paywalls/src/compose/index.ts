/**
 * `@voidhash/paywalls/compose` — the composition authoring surface + toolchain.
 *
 * Two audiences share this entry:
 *
 * - **Paywall authors** write `.paywall.tsx` files that
 *   `import { paywall, Screen, View, Text, variable, product, purchase,
 *   closePaywall, none, payload } from "@voidhash/paywalls/compose"`. Those are
 *   the inert author surface (analyzed, never executed).
 * - **Tooling** (the closed mimic bridge, the studio) imports the grammar
 *   `parseComposition`, the deterministic `printComposition`, the public
 *   {@link CompositionAST}, the registry vocabulary, and `generateComposeDts`.
 *
 * This entry is mimic-free: it never imports the mimic document model. The
 * mimic snapshot↔AST lift/lower lives in the closed `paywall-composition`
 * bridge, driven by this AST.
 */

// Author surface (inert; for author files and type-checking).
export {
  closePaywall,
  none,
  paywall,
  payload,
  product,
  purchase,
  Screen,
  Text,
  variable,
  View,
  type Action,
  type ProductRef,
  type VariableHandle,
} from "./author-surface";

// Public serializable AST (the OSS ↔ closed-bridge seam).
export type {
  CompositionAction,
  CompositionActionBinding,
  CompositionAST,
  CompositionComponentNode,
  CompositionElementNode,
  CompositionInteraction,
  CompositionNode,
  CompositionProductSource,
  CompositionPropBinding,
  CompositionPropValue,
  CompositionScalarSource,
  CompositionStyleValue,
  CompositionVariable,
  CompositionVariableType,
} from "./ast";

// Grammar / parser / printer.
export { CompositionError } from "./error";
export { parseComposition, type ParseCompositionOptions } from "./parser";
export { printComposition, type PrintCompositionOptions } from "./printer";
export {
  NODE_STYLE_VOCABULARY,
  styleFieldFor,
  styleFieldsOf,
  TAG_TO_TYPE,
  TYPE_TO_TAG,
  type CompositionNodeType,
  type NodeStyleVocabulary,
} from "./grammar";

// Component/registry vocabulary (prop/action kinds from `../schema`).
export {
  arrayItemKey,
  defaultComponentTag,
  registryByTag,
  resolveComponentForNode,
  scalarPropValueKey,
  variableTypeForPropKind,
  type CompositionActionDef,
  type CompositionComponent,
  type CompositionComponentManifest,
  type CompositionPropDef,
  type CompositionPropKind,
  type CompositionRegistry,
} from "./component";

// Monaco `.d.ts` generation.
export { generateComposeDts } from "./generate-dts";
