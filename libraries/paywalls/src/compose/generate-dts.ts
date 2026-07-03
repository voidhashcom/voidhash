import {
  NODE_STYLE_ENTRIES,
  STYLE_FIELD_TYPES,
  type StyleFieldName,
  type StyleValueDescriptor,
} from "../schema/style-registry";
import type { CompositionPropDef, CompositionRegistry } from "./component";

/**
 * Generates the `@voidhash/paywalls/compose` authoring surface as a `.d.ts`
 * string for the in-browser Monaco editor.
 *
 * The built-in tag declarations (`Screen`/`View`/`Text`) are generated from the
 * shared `../schema/style-registry` value-type descriptors — the SAME source the
 * static author surface (`./style-attr-types` + `./author-surface`) derives its
 * types from — with the style fields nested inside a single `style?: { … }` member
 * (converging with the code-component authoring look), so the ambient d.ts and the
 * real surface cannot drift; a
 * `base-module-sync` test locks this. Monaco has no access to package-internal
 * type imports, so every descriptor is rendered to an inline literal type here
 * (the module is a self-contained ambient `declare module`).
 *
 * The non-tag declarations (`paywall`, `variable`, the marker helpers, and the
 * `Action`/`ProductRef`/`VariableHandle` types) mirror `./author-surface` as
 * literal strings — they have no registry to derive from, and the sync test
 * still asserts every author-surface symbol appears in the generated output.
 */

/** The `Action`/`ProductRef`/`VariableHandle` types + inert markers, verbatim. */
const HELPER_MODULE = `
  export interface VariableHandle<T> {
    readonly __type: T;
    set(value: T): Action;
  }
  export interface ProductRef {
    readonly __product: true;
  }
  export interface Action {
    readonly __action: true;
  }
  type Node = unknown;
  export function paywall(build: () => Node): Node;
  export const variable: {
    string(name: string, opts?: { default?: string }): VariableHandle<string>;
    number(name: string, opts?: { default?: number }): VariableHandle<number>;
    boolean(name: string, opts?: { default?: boolean }): VariableHandle<boolean>;
    product(name: string): VariableHandle<ProductRef>;
  };
  export function product(id: string): ProductRef;
  export function purchase(product: ProductRef | VariableHandle<ProductRef>): Action;
  export function closePaywall(): Action;
  export function none(): Action;
  export function payload(field: string): any;`;

/** The structured background value shapes, inlined so the ambient module is self-contained. */
const STRUCTURED_TYPES = `
  interface StyleGradientValue {
    kind: "linear" | "radial";
    startX: number;
    startY: number;
    endX: number;
    endY: number;
    stops: { color: string; position: number }[];
  }
  interface StyleImageValue {
    url: string;
    resizeMode: "cover" | "contain" | "stretch" | "center";
  }`;

/**
 * Generate the ambient `.d.ts` for the composition authoring surface: the
 * helper/marker declarations, the generated built-in tag declarations, and a
 * typed JSX tag per registry component so Monaco offers real prop/action
 * completions and diagnostics.
 */
export function generateComposeDts(registry?: CompositionRegistry): string {
  const builtins = [
    tagDeclaration("Screen", "screen", { onPress: false, textChild: false }),
    tagDeclaration("View", "view", { onPress: true, textChild: false }),
    tagDeclaration("Text", "text", { onPress: false, textChild: true }),
  ].join("\n");
  const components = (registry?.components ?? [])
    .map((component) => componentDeclaration(component.tag, component.manifest))
    .join("\n");
  const body = `${HELPER_MODULE}\n${STRUCTURED_TYPES}\n${builtins}${
    components.length > 0 ? `\n${components}` : ""
  }`;
  return `declare module "@voidhash/paywalls/compose" {${body}\n}\n`;
}

interface TagShape {
  /** Whether the node accepts an `onPress` action attribute (`<View>` only). */
  readonly onPress: boolean;
  /** Whether children are a literal string (`<Text>`) vs element children. */
  readonly textChild: boolean;
}

/**
 * Render a built-in tag declaration from its per-node style entries + shape. The
 * style fields are nested inside a single `style?: { … }` member (converging with
 * the code-component authoring look); `name?`/`onPress?`/`children?` stay siblings.
 */
function tagDeclaration(tag: string, node: keyof typeof NODE_STYLE_ENTRIES, shape: TagShape): string {
  const styleMembers: string[] = [];
  for (const entry of NODE_STYLE_ENTRIES[node]) {
    const descriptor = STYLE_FIELD_TYPES[entry.field as StyleFieldName];
    styleMembers.push(`        ${entry.field}?: ${descriptorTsType(descriptor)};`);
  }
  const members: string[] = [`      style?: {\n${styleMembers.join("\n")}\n      };`];
  members.push(`      name?: string;`);
  if (shape.onPress) {
    members.push(`      onPress?: Action;`);
  }
  members.push(shape.textChild ? `      children?: string;` : `      children?: Node | Node[];`);
  return `  export const ${tag}: (props: {\n${members.join("\n")}\n  }) => Node;`;
}

/** Render a value-type descriptor to its inline TS type string. */
function descriptorTsType(descriptor: StyleValueDescriptor): string {
  switch (descriptor.kind) {
    case "number":
      return "number";
    case "color":
    case "string":
      return "string";
    case "boolean":
      return "boolean";
    case "dimension":
      return 'number | "auto"';
    case "enum":
      return descriptor.values.map((value) => JSON.stringify(value)).join(" | ");
    case "gradient":
      return "StyleGradientValue";
    case "image":
      return "StyleImageValue";
  }
}

function componentDeclaration(
  tag: string,
  manifest: {
    props: Readonly<Record<string, CompositionPropDef>>;
    actions?: Readonly<Record<string, unknown>>;
    slot?: boolean;
  },
): string {
  const members: string[] = [];
  for (const [name, def] of Object.entries(manifest.props)) {
    members.push(`      ${propMember(name, def)}`);
  }
  for (const name of Object.keys(manifest.actions ?? {})) {
    members.push(`      ${jsxName(name)}?: Action;`);
  }
  members.push(`      name?: string;`);
  if (manifest.slot) {
    members.push(`      children?: Node | Node[];`);
  }
  return `  export const ${tag}: (props: {\n${members.join("\n")}\n  }) => Node;`;
}

function propMember(name: string, def: CompositionPropDef): string {
  const optional = def.optional === false ? "" : "?";
  return `${jsxName(name)}${optional}: ${propTsType(def)};`;
}

function propTsType(def: CompositionPropDef): string {
  switch (def.kind) {
    case "string":
    case "image":
      return "string | VariableHandle<string>";
    case "select":
      return def.options && def.options.length > 0
        ? `(${def.options.map((o) => JSON.stringify(o)).join(" | ")}) | VariableHandle<string>`
        : "string | VariableHandle<string>";
    case "number":
      return "number | VariableHandle<number>";
    case "boolean":
      return "boolean | VariableHandle<boolean>";
    case "ref":
      return "ProductRef | VariableHandle<ProductRef>";
    case "array":
      return `(${scalarTsType(def.item?.kind)})[]`;
    case "component":
      return "Node";
  }
}

function scalarTsType(kind: CompositionPropDef["kind"] | undefined): string {
  switch (kind) {
    case "number":
      return "number";
    case "boolean":
      return "boolean";
    default:
      return "string";
  }
}

/** Quote a prop/action name that isn't a bare JS identifier (defensive). */
function jsxName(name: string): string {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name) ? name : JSON.stringify(name);
}
