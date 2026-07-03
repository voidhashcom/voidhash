import type {
  CompositionAction,
  CompositionActionBinding,
  CompositionAST,
  CompositionComponentNode,
  CompositionElementNode,
  CompositionInteraction,
  CompositionNode,
  CompositionProductSource,
  CompositionPropBinding,
  CompositionScalarSource,
  CompositionStyleValue,
  CompositionVariable,
} from "./ast";
import type { CompositionComponent, CompositionRegistry } from "./component";
import { NODE_STYLE_VOCABULARY, TYPE_TO_TAG, type CompositionNodeType } from "./grammar";

/** Options for {@link printComposition}. */
export interface PrintCompositionOptions {
  /** Components referenced by `component` nodes. Required to print such nodes. */
  readonly registry?: CompositionRegistry;
}

/**
 * Serialize a {@link CompositionAST} back into deterministic `.paywall.tsx`
 * source.
 *
 * Deterministic: style keys are emitted in schema field order, values equal to
 * the schema default are omitted, and identifiers are derived from stable
 * variable names — so parsing the printed source reconstructs an equivalent AST
 * and a no-op round-trip reconciles to zero commands.
 */
export function printComposition(ast: CompositionAST, options?: PrintCompositionOptions): string {
  const printer = new Printer(options?.registry);

  // Identifiers are disambiguated so two variable names that sanitize to the
  // same JS identifier never emit a duplicate `const` (parser-authored names
  // are already unique + valid, so this is a no-op for them).
  const usedIdents = new Set<string>();
  const variables: VarBinding[] = ast.variables.map((v) => {
    const base = identifierFor(v.name);
    let ident = base;
    for (let n = 2; usedIdents.has(ident); n += 1) {
      ident = `${base}_${n}`;
    }
    usedIdents.add(ident);
    return { ident, variable: v };
  });
  printer.registerVariables(variables);

  const screenJsx = printer.element(ast.root, 4);
  const varLines = variables.map((v) => `  ${printer.variableDeclaration(v)}`);

  const body = [...varLines, "", "  return (", screenJsx, "  );"].join("\n");

  return [printer.imports(), "", "export default paywall(() => {", body, "});", ""].join("\n");
}

interface VarBinding {
  readonly ident: string;
  readonly variable: CompositionVariable;
}

class Printer {
  private readonly identByName = new Map<string, string>();
  private readonly usedTags = new Set<string>();
  private readonly usedHelpers = new Set<string>();
  private readonly registry?: CompositionRegistry;

  constructor(registry?: CompositionRegistry) {
    this.registry = registry;
  }

  registerVariables(vars: readonly VarBinding[]): void {
    for (const v of vars) {
      this.identByName.set(v.variable.name, v.ident);
      this.usedHelpers.add("variable");
    }
  }

  imports(): string {
    const names = ["paywall", ...[...this.usedHelpers].sort(), ...[...this.usedTags].sort()];
    return `import { ${names.join(", ")} } from "@voidhash/paywalls/compose";`;
  }

  variableDeclaration(v: VarBinding): string {
    const opts = this.variableOptions(v.variable);
    return `const ${v.ident} = variable.${v.variable.type}(${JSON.stringify(v.variable.name)}${opts});`;
  }

  private variableOptions(v: CompositionVariable): string {
    if (v.type === "product") {
      return "";
    }
    const value = v.defaultValue;
    const isDefault =
      (v.type === "string" && value === "") ||
      (v.type === "number" && value === 0) ||
      (v.type === "boolean" && value === false);
    return isDefault ? "" : `, { default: ${JSON.stringify(value)} }`;
  }

  element(node: CompositionNode, indentCols: number): string {
    if (node.kind === "component") {
      return this.componentElement(node, indentCols);
    }
    const type = node.type;
    // Guard against ASTs built outside the parser/lifter: an unknown type would
    // otherwise surface as an opaque TypeError on the vocabulary lookup below.
    if (!Object.hasOwn(NODE_STYLE_VOCABULARY, type)) {
      throw new Error(
        `Cannot print a "${type}" node: the composition grammar only represents ` +
          `${Object.keys(NODE_STYLE_VOCABULARY).join("/")} nodes`,
      );
    }
    const tag = TYPE_TO_TAG[type];
    this.usedTags.add(tag);

    const attrs = this.attributes(node, type);
    const pad = " ".repeat(indentCols);

    if (type === "text") {
      const text = node.text ?? "";
      const open = attrs.length > 0 ? `<${tag} ${attrs.join(" ")}>` : `<${tag}>`;
      return `${pad}${open}${renderTextChild(text)}</${tag}>`;
    }

    const children = node.children.map((child) => this.element(child, indentCols + 2));
    if (children.length === 0) {
      const inner = attrs.length > 0 ? `<${tag} ${attrs.join(" ")} />` : `<${tag} />`;
      return `${pad}${inner}`;
    }
    const open = attrs.length > 0 ? `<${tag} ${attrs.join(" ")}>` : `<${tag}>`;
    return [`${pad}${open}`, ...children, `${pad}</${tag}>`].join("\n");
  }

  private attributes(node: CompositionElementNode, type: CompositionNodeType): string[] {
    const attrs: string[] = [];
    const meta = NODE_STYLE_VOCABULARY[type];

    if (node.name !== undefined && node.name !== meta.defaultName) {
      attrs.push(formatStringAttr("name", node.name));
    }

    const styleAttr = this.styleAttribute(node.style, type);
    if (styleAttr) {
      attrs.push(styleAttr);
    }

    if (type === "view") {
      const onPress = this.onPress(node.interactions);
      if (onPress) {
        attrs.push(onPress);
      }
    }
    return attrs;
  }

  /**
   * The single `style={{ … }}` attribute for a node, or null when no non-default
   * field survives (so an all-default element prints no style attribute at all).
   * Fields are emitted in registry `styleFields` order; a field equal to its
   * schema default is omitted. The object body is single-line, produced by
   * {@link formatStyleExpr}.
   */
  private styleAttribute(
    style: Readonly<Record<string, CompositionStyleValue>>,
    type: CompositionNodeType,
  ): string | null {
    const meta = NODE_STYLE_VOCABULARY[type];
    const entries: [string, CompositionStyleValue][] = [];

    for (const field of meta.styleFields) {
      if (!(field in style)) {
        continue;
      }
      const value = style[field];
      if (value === undefined) {
        continue;
      }
      if (field in meta.defaultStyle && deepEqual(value, meta.defaultStyle[field])) {
        continue;
      }
      entries.push([field, value]);
    }

    if (entries.length === 0) {
      return null;
    }
    const body = entries.map(([key, value]) => `${styleKey(key)}: ${formatStyleExpr(value)}`).join(", ");
    return `style={{ ${body} }}`;
  }

  private onPress(interactions: readonly CompositionInteraction[]): string | null {
    const click = interactions.find((i) => i.trigger === "click");
    if (!click) {
      return null;
    }
    const expr = this.actionExpr(click.action);
    return expr ? `onPress={${expr}}` : null;
  }

  private actionExpr(action: CompositionAction): string | null {
    switch (action.kind) {
      case "close-paywall":
        this.usedHelpers.add("closePaywall");
        return "closePaywall()";
      case "none":
        this.usedHelpers.add("none");
        return "none()";
      case "purchase":
        this.usedHelpers.add("purchase");
        return `purchase(${this.productSource(action.product)})`;
      case "set-variable": {
        const ident = this.identByName.get(action.variableName) ?? action.variableName;
        return `${ident}.set(${this.actionValueSource(action.value)})`;
      }
    }
  }

  private productSource(source: CompositionProductSource): string {
    if (source.kind === "variable") {
      return this.identByName.get(source.variableName) ?? source.variableName;
    }
    if (source.kind === "payload") {
      this.usedHelpers.add("payload");
      return `payload(${JSON.stringify(source.field)})`;
    }
    this.usedHelpers.add("product");
    return `product(${JSON.stringify(source.productId)})`;
  }

  private actionValueSource(source: CompositionScalarSource): string {
    if (source.kind === "variable") {
      return this.identByName.get(source.variableName) ?? source.variableName;
    }
    if (source.kind === "payload") {
      this.usedHelpers.add("payload");
      return `payload(${JSON.stringify(source.field)})`;
    }
    if (source.kind === "literal-product") {
      this.usedHelpers.add("product");
      // A parser-authored product literal always carries a productId. An ABSENT
      // productId ("no product selected") only arises in a designer-authored
      // document; it collapses to product("") here and round-trips faithfully
      // only once designer-doc fidelity lands (Phase 2 voidhash.lock).
      return `product(${JSON.stringify(source.productId)})`;
    }
    return JSON.stringify(source.value);
  }

  // ---- code-component instances -------------------------------------------

  private componentElement(node: CompositionComponentNode, indentCols: number): string {
    // The AST carries the referenced tag directly, which is the authoritative
    // registry key on print — resolve by tag against the registry.
    const resolved = this.registry?.components.find((c) => c.tag === node.tag);
    if (!resolved) {
      throw new Error(`Cannot print a component instance: no registry entry for tag "${node.tag}"`);
    }
    this.usedTags.add(resolved.tag);
    const tag = resolved.tag;
    const attrs = this.componentAttributes(node, resolved);
    const pad = " ".repeat(indentCols);

    const children = node.children.map((child) => this.element(child, indentCols + 2));
    if (children.length === 0) {
      const inner = attrs.length > 0 ? `<${tag} ${attrs.join(" ")} />` : `<${tag} />`;
      return `${pad}${inner}`;
    }
    const open = attrs.length > 0 ? `<${tag} ${attrs.join(" ")}>` : `<${tag}>`;
    return [`${pad}${open}`, ...children, `${pad}</${tag}>`].join("\n");
  }

  private componentAttributes(
    node: CompositionComponentNode,
    component: CompositionComponent,
  ): string[] {
    const attrs: string[] = [];

    // Skip the reserved display-name attribute when the component declares a
    // prop literally named "name" (that prop owns the `name=` attribute instead).
    if (
      component.manifest.props["name"] === undefined &&
      node.name !== undefined &&
      node.name !== "Component"
    ) {
      attrs.push(formatStringAttr("name", node.name));
    }

    // Props in manifest order (deterministic; unknown/stale props are dropped).
    const propByName = new Map<string, CompositionPropBinding["value"]>();
    for (const binding of node.props) {
      propByName.set(binding.name, binding.value);
    }
    for (const propName of Object.keys(component.manifest.props)) {
      const binding = propByName.get(propName);
      if (binding !== undefined) {
        const printed = this.propAttr(propName, binding);
        if (printed) {
          attrs.push(printed);
        }
      }
    }

    // Action bindings in manifest order.
    const actionByName = new Map<string, CompositionActionBinding["action"]>();
    for (const binding of node.actionBindings) {
      actionByName.set(binding.name, binding.action);
    }
    for (const actionName of Object.keys(component.manifest.actions ?? {})) {
      const action = actionByName.get(actionName);
      if (action !== undefined) {
        const expr = this.actionExpr(action);
        if (expr) {
          attrs.push(`${actionName}={${expr}}`);
        }
      }
    }
    return attrs;
  }

  private propAttr(propName: string, binding: CompositionPropBinding["value"]): string | null {
    switch (binding.kind) {
      case "variable": {
        const ident = this.identByName.get(binding.variableName) ?? binding.variableName;
        return `${propName}={${ident}}`;
      }
      case "literal-string":
        return formatStringAttr(propName, binding.value);
      case "literal-number":
        return `${propName}={${binding.value}}`;
      case "literal-boolean":
        return binding.value ? propName : `${propName}={false}`;
      case "literal-product":
        this.usedHelpers.add("product");
        return `${propName}={product(${JSON.stringify(binding.productId)})}`;
      case "literal-string-array":
      case "literal-number-array":
      case "literal-boolean-array":
        return `${propName}={${JSON.stringify(binding.value)}}`;
    }
  }
}

/**
 * Format a string as a JSX attribute value. A plain string with no JSX-special
 * characters uses the readable `="…"` form; anything else — including chars that
 * `JSON.stringify` escapes but a double-quoted JSX attribute does NOT un-escape
 * (quote, backslash, tab, CR, newline) — goes through a `{"…"}` expression the
 * parser reads back byte-for-byte. A raw `="…"` there would corrupt the value.
 */
function formatStringAttr(name: string, value: string): string {
  const needsExpression = /["\\<>{}\n\r\t]/.test(value);
  return needsExpression
    ? `${name}={${JSON.stringify(value)}}`
    : `${name}=${JSON.stringify(value)}`;
}

/** A style object key: a bare identifier, or a quoted string for a non-identifier (defensive). */
function styleKey(key: string): string {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key) ? key : JSON.stringify(key);
}

/**
 * Formats a JSON-ish structured style value as a JSX expression. Object keys are
 * emitted in insertion order (the printer only ever prints values whose key
 * order matches the canonical field order of the type), mirroring the readable
 * `{ key: value, … }` / `[a, b]` forms authors write by hand.
 */
function formatStyleExpr(value: CompositionStyleValue): string {
  if (typeof value === "string") {
    return JSON.stringify(value);
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => formatStyleExpr(item)).join(", ")}]`;
  }
  const entries = Object.entries(value as Record<string, CompositionStyleValue>);
  if (entries.length === 0) {
    return "{}";
  }
  const body = entries.map(([key, item]) => `${styleKey(key)}: ${formatStyleExpr(item)}`).join(", ");
  return `{ ${body} }`;
}

/** Structural deep-equality for JSON-ish style values (scalars, arrays, objects). */
function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) {
    return true;
  }
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) {
    return false;
  }
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) {
      return false;
    }
    return a.every((item, index) => deepEqual(item, b[index]));
  }
  const aKeys = Object.keys(a as Record<string, unknown>);
  const bKeys = Object.keys(b as Record<string, unknown>);
  if (aKeys.length !== bKeys.length) {
    return false;
  }
  return aKeys.every(
    (key) =>
      Object.hasOwn(b as Record<string, unknown>, key) &&
      deepEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]),
  );
}

/**
 * Renders text as a JSX child. Plain, already-trimmed text with no JSX-special
 * characters is emitted verbatim; anything else (braces / angle brackets /
 * newlines, or significant leading/trailing whitespace, or empty) goes through a
 * string-literal expression the parser reads back byte-for-byte.
 */
function renderTextChild(text: string): string {
  const needsExpression = /[{}<>\n]/.test(text) || text.trim() !== text || text.length === 0;
  return needsExpression ? `{${JSON.stringify(text)}}` : text;
}

/** A valid JS identifier from a variable name, or a deterministic sanitization. */
function identifierFor(name: string): string {
  if (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name)) {
    return name;
  }
  const cleaned = name.replace(/[^A-Za-z0-9_$]/g, "_");
  return /^[A-Za-z_$]/.test(cleaned) ? cleaned : `_${cleaned}`;
}
