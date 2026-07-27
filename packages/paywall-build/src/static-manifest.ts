/**
 * Static, execution-free extraction of a §2 component manifest from a
 * `defineComponent(...)` source file.
 *
 * The runtime extractor ({@link extractComponentManifest} in
 * `@voidhash/paywalls`) EVALUATES compiled component code and reads the resolved
 * builders. That evaluation seam is unavailable on the deployed workerd worker
 * (no compile, no isolate), so a freshly authored component there would have no
 * manifest at all — its composition bindings could not be validated and a
 * correct paywall would loop the AI agent forever.
 *
 * `defineComponent` is a CLOSED declarative grammar, though: props are a literal
 * object of chained builder calls (`p.string().label("…").default("…")`),
 * actions likewise (`a.action({ product: a.string() })`), and slot presence is
 * observable as `<Slot/>` JSX. That is fully derivable from the TypeScript AST
 * without running anything — a "nothing is ever executed" static-analysis
 * philosophy.
 *
 * Output contract vs the runtime extractor: props, actions, defaults, title,
 * and description are IDENTICAL for any statically-analyzable definition (the
 * result always passes `parseComponentManifest`). The render-derived heuristics
 * (`slot`, `hostData`) are resolved through the file's ACTUAL import bindings —
 * named (`Slot`), aliased (`Slot as S`), and namespace (`import * as P` →
 * `<P.Slot/>`) — by walking the render body's AST, which is deliberately
 * STRICTER than the runtime's compiled-source regexes: only real JSX/hook usage
 * counts, a `Slot` mention in a string or comment does not. Anything outside
 * the closed grammar returns diagnostics — never a partial guess.
 */
import ts from "typescript";
import { COMPONENT_MANIFEST_VERSION } from "@voidhash/paywalls/schema";
import type { ExtractOutcome } from "./types.ts";

/** The product-reading runtime hooks that imply `hostData: ["products"]`. */
const PRODUCT_HOOKS = new Set(["usePaywallProducts", "useSelectedProduct", "usePaywallConfig"]);

/** The SDK root specifier whose import bindings the render scan resolves. */
const SDK_SPECIFIER = "@voidhash/paywalls";

/**
 * The file's local bindings for `@voidhash/paywalls` exports: `named` maps each
 * local name to the SDK export it binds (`import { Slot as S }` ⇒ `S → Slot`);
 * `namespaces` holds namespace-import locals (`import * as P` ⇒ member access
 * `P.Slot` references the `Slot` export).
 */
interface SdkBindings {
  readonly named: ReadonlyMap<string, string>;
  readonly namespaces: ReadonlySet<string>;
}

/** Collect the SDK import bindings declared by a source file. */
function sdkBindingsOf(file: ts.SourceFile): SdkBindings {
  const named = new Map<string, string>();
  const namespaces = new Set<string>();
  for (const statement of file.statements) {
    if (!ts.isImportDeclaration(statement)) continue;
    const spec = statement.moduleSpecifier;
    if (!ts.isStringLiteral(spec) || spec.text !== SDK_SPECIFIER) continue;
    const bindings = statement.importClause?.namedBindings;
    if (!bindings) continue;
    if (ts.isNamedImports(bindings)) {
      for (const element of bindings.elements) {
        named.set(element.name.text, element.propertyName?.text ?? element.name.text);
      }
    } else if (ts.isNamespaceImport(bindings)) {
      namespaces.add(bindings.name.text);
    }
  }
  return { named, namespaces };
}

/**
 * True when an expression references the given SDK export through the file's
 * bindings: a (possibly aliased) named-import identifier, or a `P.<export>`
 * member access on a namespace import.
 */
function isSdkExportRef(expr: ts.Node, exported: string, bindings: SdkBindings): boolean {
  if (ts.isIdentifier(expr)) {
    return bindings.named.get(expr.text) === exported;
  }
  if (ts.isPropertyAccessExpression(expr)) {
    return (
      ts.isIdentifier(expr.expression) &&
      bindings.namespaces.has(expr.expression.text) &&
      expr.name.text === exported
    );
  }
  return false;
}

/**
 * Walk a render body for `<Slot/>` JSX usage and product-hook calls, resolved
 * through the file's SDK import bindings. Mirrors the runtime extractor's
 * `detectSlotUsage`/`detectProductHookUsage` intent but is deliberately
 * stricter: only a real JSX element / call expression of the bound name counts
 * (string and comment mentions never match), and aliased or namespace imports
 * are followed to their SDK export.
 */
function scanRenderUsage(
  render: ts.Node,
  bindings: SdkBindings,
): { slot: boolean; productHook: boolean } {
  const usage = { slot: false, productHook: false };
  const visit = (node: ts.Node): void => {
    if (
      (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) &&
      isSdkExportRef(node.tagName, "Slot", bindings)
    ) {
      usage.slot = true;
    }
    if (ts.isCallExpression(node)) {
      for (const hook of PRODUCT_HOOKS) {
        if (isSdkExportRef(node.expression, hook, bindings)) {
          usage.productHook = true;
          break;
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(render);
  return usage;
}

/** Prop builder factory methods and the manifest `kind` each produces. */
const PROP_FACTORY_KINDS: Readonly<Record<string, string>> = {
  string: "string",
  number: "number",
  boolean: "boolean",
  select: "select",
  image: "image",
  ref: "ref",
  component: "component",
  array: "array",
};

/**
 * Raised when a `defineComponent` construct is outside the statically-analyzable
 * grammar. The message is author-facing — it tells them to keep the definition
 * declarative rather than reporting a partial (and therefore wrong) manifest.
 */
class StaticExtractError extends Error {}

/** Fail with an author-facing message; caught and surfaced as diagnostics. */
function bail(detail: string): never {
  throw new StaticExtractError(
    `${detail} Keep \`defineComponent\` declarative — props/actions must be a literal ` +
      "object of chained `p.*`/`a.*` builder calls with literal arguments so the " +
      "manifest can be derived without executing the component.",
  );
}

/** Unwrap `x as T` and `(x)` wrappers around an expression. */
function unwrap(expr: ts.Expression): ts.Expression {
  let node: ts.Expression = expr;
  while (ts.isAsExpression(node) || ts.isParenthesizedExpression(node)) {
    node = node.expression;
  }
  return node;
}

/** A literal string/number/boolean/null value, or `bail` for anything else. */
function literalValue(expr: ts.Expression): unknown {
  const node = unwrap(expr);
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (ts.isNumericLiteral(node)) return Number(node.text);
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (
    ts.isPrefixUnaryExpression(node) &&
    node.operator === ts.SyntaxKind.MinusToken &&
    ts.isNumericLiteral(node.operand)
  ) {
    return -Number(node.operand.text);
  }
  if (ts.isArrayLiteralExpression(node)) {
    return node.elements.map((el) => literalValue(el));
  }
  return bail("A default or option value is not a literal.");
}

/** Require an array-literal of string literals (for `p.select([...])`). */
function stringLiteralArray(expr: ts.Expression, what: string): string[] {
  const node = unwrap(expr);
  if (!ts.isArrayLiteralExpression(node)) bail(`${what} must be an array literal of strings.`);
  return (node as ts.ArrayLiteralExpression).elements.map((el) => {
    const item = unwrap(el);
    if (ts.isStringLiteral(item) || ts.isNoSubstitutionTemplateLiteral(item)) return item.text;
    return bail(`${what} must contain only string literals.`);
  });
}

/** A single `p.*()` builder chain, resolved to the intermediate prop schema. */
interface StaticPropSchema {
  kind: string;
  label?: string;
  defaultValue?: unknown;
  hasDefault: boolean;
  editor?: string;
  localizable?: boolean;
  optional: boolean;
  options?: string[];
  refType?: string;
  item?: StaticPropSchema;
}

/**
 * Decompose a builder chain (`p.string().label("…").default(x)`) into its base
 * factory call and the ordered list of modifier calls applied on top of it.
 */
function decomposeChain(expr: ts.Expression): {
  base: ts.CallExpression;
  modifiers: ts.CallExpression[];
} {
  const modifiers: ts.CallExpression[] = [];
  let node = unwrap(expr);
  while (
    ts.isCallExpression(node) &&
    ts.isPropertyAccessExpression(node.expression) &&
    !isFactoryRoot(node.expression)
  ) {
    modifiers.unshift(node);
    node = unwrap(node.expression.expression);
  }
  if (!ts.isCallExpression(node)) {
    bail("A prop must be a `p.*()` builder call.");
  }
  return { base: node as ts.CallExpression, modifiers };
}

/**
 * True when a property access is a factory root call (`p.string`) rather than a
 * chained modifier (`something.label`): its object is a plain identifier (the
 * `p` factory parameter) AND the accessed method is a known factory method. This
 * lets {@link decomposeChain} stop unwrapping at the base builder.
 */
function isFactoryRoot(access: ts.PropertyAccessExpression): boolean {
  return (
    ts.isIdentifier(access.expression) &&
    Object.prototype.hasOwnProperty.call(PROP_FACTORY_KINDS, access.name.text)
  );
}

/** Resolve one `p.*()` builder chain into a static prop schema. */
function resolvePropBuilder(expr: ts.Expression): StaticPropSchema {
  const { base, modifiers } = decomposeChain(expr);
  const callee = base.expression;
  if (!ts.isPropertyAccessExpression(callee) || !ts.isIdentifier(callee.expression)) {
    bail("A prop must be a `p.<kind>()` builder call.");
  }
  const method = (callee as ts.PropertyAccessExpression).name.text;
  const kind = PROP_FACTORY_KINDS[method];
  if (kind === undefined) {
    bail(`Unknown prop builder \`p.${method}(...)\`.`);
  }

  const schema: StaticPropSchema = { kind: kind!, hasDefault: false, optional: false };

  switch (kind) {
    case "select": {
      const arg = base.arguments[0];
      if (arg === undefined) bail("`p.select(...)` requires an options array.");
      schema.options = stringLiteralArray(arg, "`p.select(...)` options");
      break;
    }
    case "ref": {
      const arg = base.arguments[0];
      const value = arg ? literalValue(arg) : undefined;
      if (typeof value !== "string") bail("`p.ref(...)` requires a string refType literal.");
      schema.refType = value;
      break;
    }
    case "array": {
      const arg = base.arguments[0];
      if (arg === undefined) bail("`p.array(...)` requires an item builder.");
      const item = resolvePropBuilder(arg);
      if (item.kind === "array") bail("`p.array(...)` items must be a non-array prop kind.");
      schema.item = item;
      break;
    }
    default:
      break;
  }

  applyPropModifiers(schema, modifiers);
  return schema;
}

/** Apply the chained `.label()/.default()/.optional()/.editor()/.localizable()` modifiers. */
function applyPropModifiers(schema: StaticPropSchema, modifiers: ts.CallExpression[]): void {
  for (const modifier of modifiers) {
    const access = modifier.expression;
    if (!ts.isPropertyAccessExpression(access)) {
      bail("A prop modifier must be a method call.");
    }
    const name = (access as ts.PropertyAccessExpression).name.text;
    switch (name) {
      case "label": {
        const value = literalValue(requireArg(modifier, "`.label(...)`"));
        if (typeof value !== "string") bail("`.label(...)` requires a string literal.");
        schema.label = value;
        break;
      }
      case "default": {
        schema.defaultValue = literalValue(requireArg(modifier, "`.default(...)`"));
        schema.hasDefault = true;
        break;
      }
      case "editor": {
        const value = literalValue(requireArg(modifier, "`.editor(...)`"));
        if (typeof value !== "string") bail("`.editor(...)` requires a string literal.");
        schema.editor = value;
        break;
      }
      case "optional": {
        schema.optional = true;
        break;
      }
      case "localizable": {
        if (modifier.arguments.length > 0) bail("`.localizable()` takes no arguments.");
        if (schema.kind !== "string" && schema.kind !== "image") {
          bail(`\`.localizable()\` is only valid on \`p.string()\`/\`p.image()\` props, not \`${schema.kind}\`.`);
        }
        schema.localizable = true;
        break;
      }
      default:
        bail(`Unknown prop modifier \`.${name}(...)\`.`);
    }
  }
}

/** The single argument of a modifier call, or `bail` when absent. */
function requireArg(call: ts.CallExpression, label: string): ts.Expression {
  const arg = call.arguments[0];
  if (arg === undefined) bail(`${label} requires an argument.`);
  return arg;
}

const isJsonScalar = (value: unknown): value is string | number | boolean =>
  typeof value === "string" || typeof value === "number" || typeof value === "boolean";

/** Defaults survive only when JSON-serializable losslessly (runtime parity). */
function serializableDefault(value: unknown): unknown {
  if (isJsonScalar(value)) return value;
  if (Array.isArray(value) && value.every(isJsonScalar)) return value;
  return undefined;
}

/** Lower a static array-item schema to the manifest array-item shape. */
function toManifestItem(item: StaticPropSchema): Record<string, unknown> {
  return {
    kind: item.kind,
    ...(item.options ? { options: item.options } : {}),
    ...(item.refType ? { refType: item.refType } : {}),
    ...(item.editor ? { editor: item.editor } : {}),
  };
}

/** Lower a static prop schema to the manifest prop shape (runtime-identical). */
function toManifestProp(schema: StaticPropSchema): Record<string, unknown> {
  const defaultValue = schema.hasDefault ? serializableDefault(schema.defaultValue) : undefined;
  return {
    kind: schema.kind,
    ...(schema.kind === "select" && schema.options ? { options: schema.options } : {}),
    ...(schema.kind === "ref" && schema.refType ? { refType: schema.refType } : {}),
    ...(schema.kind === "array" && schema.item ? { item: toManifestItem(schema.item) } : {}),
    ...(schema.label !== undefined ? { label: schema.label } : {}),
    ...(defaultValue !== undefined ? { default: defaultValue } : {}),
    ...(schema.editor !== undefined ? { editor: schema.editor } : {}),
    ...(schema.localizable ? { localizable: true } : {}),
    optional: schema.optional || schema.hasDefault,
  };
}

/**
 * The resolved contents of a `defineComponent({...})` argument, before lowering
 * to the manifest.
 */
interface ResolvedDefinition {
  title?: string;
  description?: string;
  props: Record<string, StaticPropSchema>;
  actions: Record<string, { payload: Record<string, { kind: string }> }>;
  previewNames: string[];
  previewsDeclareProducts: boolean;
  slot: boolean;
  usesProductHook: boolean;
}

/** The object-literal `defineComponent(...)` argument, or `bail`. */
function requireDefinitionObject(call: ts.CallExpression): ts.ObjectLiteralExpression {
  const arg = call.arguments[0] ? unwrap(call.arguments[0]!) : undefined;
  if (arg === undefined || !ts.isObjectLiteralExpression(arg)) {
    bail("`defineComponent(...)` must be called with an object literal.");
  }
  return arg as ts.ObjectLiteralExpression;
}

/** A property's name as a plain string, or `bail` for computed/spread names. */
function propertyName(prop: ts.ObjectLiteralElementLike): string {
  if (!ts.isPropertyAssignment(prop) && !ts.isMethodDeclaration(prop)) {
    bail("A `defineComponent` field must be a plain property (no spread or shorthand).");
  }
  const name = (prop as ts.PropertyAssignment | ts.MethodDeclaration).name;
  if (ts.isIdentifier(name) || ts.isStringLiteral(name)) return name.text;
  return bail("A `defineComponent` field name must be a plain identifier.");
}

/** The arrow/function body of a `props`/`actions` builder callback, or `bail`. */
function builderArrowBody(value: ts.Expression, field: string): ts.ObjectLiteralExpression {
  const node = unwrap(value);
  if (!ts.isArrowFunction(node)) {
    bail(`\`${field}\` must be an arrow function returning an object literal.`);
  }
  const body = (node as ts.ArrowFunction).body;
  const objectExpr = ts.isParenthesizedExpression(body)
    ? unwrap(body.expression)
    : ts.isBlock(body)
      ? blockReturnObject(body, field)
      : body;
  if (!ts.isObjectLiteralExpression(objectExpr)) {
    bail(`\`${field}\` must return an object literal of builder calls.`);
  }
  return objectExpr as ts.ObjectLiteralExpression;
}

/** The object literal returned by a single-`return` builder block body, or `bail`. */
function blockReturnObject(block: ts.Block, field: string): ts.Expression {
  const ret = block.statements.find((s) => ts.isReturnStatement(s)) as
    | ts.ReturnStatement
    | undefined;
  if (!ret || !ret.expression) bail(`\`${field}\` must return an object literal.`);
  return unwrap(ret!.expression!);
}

/** Resolve the `props` object into per-name static prop schemas. */
function resolveProps(objectExpr: ts.ObjectLiteralExpression): Record<string, StaticPropSchema> {
  const props: Record<string, StaticPropSchema> = {};
  for (const member of objectExpr.properties) {
    if (!ts.isPropertyAssignment(member)) {
      bail("Each prop must be a `name: p.*()` assignment.");
    }
    const name = propertyName(member);
    props[name] = resolvePropBuilder((member as ts.PropertyAssignment).initializer);
  }
  return props;
}

/** Resolve the `actions` object into per-name payload shapes. */
function resolveActions(
  objectExpr: ts.ObjectLiteralExpression,
): Record<string, { payload: Record<string, { kind: string }> }> {
  const actions: Record<string, { payload: Record<string, { kind: string }> }> = {};
  for (const member of objectExpr.properties) {
    if (!ts.isPropertyAssignment(member)) {
      bail("Each action must be a `name: a.action(...)` assignment.");
    }
    const name = propertyName(member);
    actions[name] = { payload: resolveActionPayload((member as ts.PropertyAssignment).initializer) };
  }
  return actions;
}

/** Resolve one `a.action(...)` call into its payload field-kind map. */
function resolveActionPayload(expr: ts.Expression): Record<string, { kind: string }> {
  const node = unwrap(expr);
  if (
    !ts.isCallExpression(node) ||
    !ts.isPropertyAccessExpression(node.expression) ||
    node.expression.name.text !== "action"
  ) {
    bail("Each action must be an `a.action(...)` call.");
  }
  const call = node as ts.CallExpression;
  const arg = call.arguments[0] ? unwrap(call.arguments[0]!) : undefined;
  if (arg === undefined) return {};
  if (!ts.isObjectLiteralExpression(arg)) {
    bail("`a.action(...)` payload must be an object literal of `a.string/number/boolean()`.");
  }
  const payload: Record<string, { kind: string }> = {};
  for (const member of (arg as ts.ObjectLiteralExpression).properties) {
    if (!ts.isPropertyAssignment(member)) {
      bail("An action payload field must be a `name: a.<kind>()` assignment.");
    }
    const name = propertyName(member);
    payload[name] = { kind: actionPayloadKind((member as ts.PropertyAssignment).initializer) };
  }
  return payload;
}

/** The scalar kind of an `a.string()/a.number()/a.boolean()` payload builder. */
function actionPayloadKind(expr: ts.Expression): string {
  const node = unwrap(expr);
  if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
    const method = node.expression.name.text;
    if (method === "string" || method === "number" || method === "boolean") return method;
  }
  return bail("An action payload field must be `a.string()`, `a.number()`, or `a.boolean()`.");
}

/**
 * Whether any preview state in a `previews` object literal declares product
 * data (`data: { products: [...] }`). Mirrors the runtime `usesProducts` term.
 * Non-literal preview STATE VALUES are ignored for this heuristic (never `bail`
 * — state fixtures are not lowered into the manifest; the previews object
 * itself is validated by {@link previewNamesOf}).
 */
function previewsDeclareProducts(value: ts.Expression): boolean {
  const node = unwrap(value);
  if (!ts.isObjectLiteralExpression(node)) return false;
  return node.properties.some((state) => {
    if (!ts.isPropertyAssignment(state)) return false;
    const stateValue = unwrap(state.initializer);
    if (!ts.isObjectLiteralExpression(stateValue)) return false;
    return stateValue.properties.some((field) => {
      if (!ts.isPropertyAssignment(field)) return false;
      if (field.name.getText() !== "data") return false;
      const data = unwrap(field.initializer);
      if (!ts.isObjectLiteralExpression(data)) return false;
      return data.properties.some(
        (dataField) =>
          ts.isPropertyAssignment(dataField) && dataField.name.getText() === "products",
      );
    });
  });
}

/**
 * Preview state names declared by a `previews` object literal, in order. The
 * runtime enumerates `Object.keys(definition.previews)`, so every statically
 * enumerable member (property assignment, shorthand, method/accessor) counts;
 * a spread or computed name would silently under-report `previewStates`, so it
 * degrades instead — matching the module's no-partial-guess philosophy.
 */
function previewNamesOf(value: ts.Expression): string[] {
  const node = unwrap(value);
  if (!ts.isObjectLiteralExpression(node)) {
    bail("`previews` must be an object literal of named preview states.");
  }
  return (node as ts.ObjectLiteralExpression).properties.map((member) => {
    if (ts.isSpreadAssignment(member)) {
      return bail("`previews` must not use spread — declare each preview state literally.");
    }
    const name = member.name;
    if (name !== undefined && (ts.isIdentifier(name) || ts.isStringLiteral(name))) {
      return name.text;
    }
    return bail("A preview state name must be a plain identifier or string literal.");
  });
}

/**
 * Resolve the `defineComponent({...})` object literal into a
 * {@link ResolvedDefinition}. `render` is required by the grammar but its body
 * is only scanned (never lowered) for `<Slot/>` and product-hook usage, resolved
 * through the file's SDK import `bindings`.
 */
function resolveDefinition(call: ts.CallExpression, bindings: SdkBindings): ResolvedDefinition {
  const object = requireDefinitionObject(call);
  const resolved: ResolvedDefinition = {
    props: {},
    actions: {},
    previewNames: [],
    previewsDeclareProducts: false,
    slot: false,
    usesProductHook: false,
  };
  let renderNode: ts.Node | undefined;

  for (const member of object.properties) {
    const name = propertyName(member);
    const value = ts.isPropertyAssignment(member)
      ? member.initializer
      : (member as ts.MethodDeclaration);
    switch (name) {
      case "title":
        resolved.title = asStringField(member, "title");
        break;
      case "description":
        resolved.description = asStringField(member, "description");
        break;
      case "props":
        resolved.props = resolveProps(builderArrowBody(value as ts.Expression, "props"));
        break;
      case "actions":
        resolved.actions = resolveActions(builderArrowBody(value as ts.Expression, "actions"));
        break;
      case "previews": {
        const previews = ts.isPropertyAssignment(member) ? member.initializer : undefined;
        if (previews) {
          resolved.previewNames = previewNamesOf(previews);
          resolved.previewsDeclareProducts = previewsDeclareProducts(previews);
        }
        break;
      }
      case "render":
        renderNode = ts.isPropertyAssignment(member) ? member.initializer : member;
        break;
      default:
        // `panel` and any other declarative field do not affect the manifest.
        break;
    }
  }

  if (renderNode) {
    const usage = scanRenderUsage(renderNode, bindings);
    resolved.slot = usage.slot;
    resolved.usesProductHook = usage.productHook;
  }
  return resolved;
}

/** A `defineComponent` string field (`title`/`description`) literal, or `bail`. */
function asStringField(member: ts.ObjectLiteralElementLike, field: string): string {
  if (!ts.isPropertyAssignment(member)) {
    bail(`\`${field}\` must be a string literal.`);
  }
  const value = literalValue((member as ts.PropertyAssignment).initializer);
  if (typeof value !== "string") bail(`\`${field}\` must be a string literal.`);
  return value;
}

/**
 * Find the `defineComponent(...)` call that a file default-exports, accepting
 * the same forms {@link validate.ts}'s `hasDefineComponentDefaultExport` does:
 * `export default defineComponent({...})`, a const-bound identifier exported as
 * default, and `export { X as default }`. Returns `null` when none is found.
 */
function findDefaultExportedDefineComponent(file: ts.SourceFile): ts.CallExpression | null {
  const isDefineCall = (expr: ts.Expression | undefined): ts.CallExpression | null => {
    if (!expr) return null;
    const node = unwrap(expr);
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "defineComponent"
    ) {
      return node;
    }
    return null;
  };

  // `const X = defineComponent(...)` bindings, for indirect default exports.
  const bindings = new Map<string, ts.CallExpression>();
  for (const statement of file.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const decl of statement.declarationList.declarations) {
      if (!ts.isIdentifier(decl.name)) continue;
      const call = isDefineCall(decl.initializer);
      if (call) bindings.set(decl.name.text, call);
    }
  }

  for (const statement of file.statements) {
    // `export default defineComponent(...)` / `export default X`
    if (ts.isExportAssignment(statement) && !statement.isExportEquals) {
      const direct = isDefineCall(statement.expression);
      if (direct) return direct;
      if (ts.isIdentifier(statement.expression)) {
        const bound = bindings.get(statement.expression.text);
        if (bound) return bound;
      }
    }
    // `export { X as default }`
    if (
      ts.isExportDeclaration(statement) &&
      statement.exportClause &&
      ts.isNamedExports(statement.exportClause)
    ) {
      for (const element of statement.exportClause.elements) {
        if (element.name.text !== "default") continue;
        const local = element.propertyName?.text ?? element.name.text;
        const bound = bindings.get(local);
        if (bound) return bound;
      }
    }
  }
  return null;
}

/**
 * Statically extract a §2 component manifest from `defineComponent(...)` source,
 * without executing it — the workerd fallback for {@link extractComponentManifest}.
 *
 * Returns the same {@link ExtractOutcome} contract as the `extractManifest`
 * capability: `{ manifest }` (an unvalidated raw value the caller runs through
 * `parseComponentManifest`, exactly like the runtime path) on success, or
 * `{ diagnostics }` when the definition is missing, malformed, or uses any
 * construct outside the closed declarative grammar. Props, actions, defaults,
 * title, and description are identical to the runtime extractor's for any
 * statically-analyzable definition; the render-derived `slot`/`hostData`
 * heuristics are import-binding-resolved AST analysis — equal to the runtime
 * for real JSX/hook usage (aliases included), deliberately stricter for
 * string/comment mentions, which never count here.
 *
 * @param source   the component's `.tsx` source text
 * @param fileName optional file name used for AST parsing (diagnostics only)
 */
export function staticExtractManifest(source: string, fileName = "component.tsx"): ExtractOutcome {
  const file = ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.Latest,
    /* setParentNodes */ true,
    ts.ScriptKind.TSX,
  );

  const call = findDefaultExportedDefineComponent(file);
  if (!call) {
    return {
      diagnostics: [
        {
          message:
            "Component must default-export `defineComponent({ ... })` (a const bound to " +
            "`defineComponent(...)` and exported as default is also accepted).",
        },
      ],
    };
  }

  try {
    const resolved = resolveDefinition(call, sdkBindingsOf(file));

    const props: Record<string, unknown> = {};
    for (const [name, schema] of Object.entries(resolved.props)) {
      assertUsableName(name);
      assertSelectHasOptions(name, schema);
      props[name] = toManifestProp(schema);
    }
    for (const name of Object.keys(resolved.actions)) {
      assertUsableName(name);
    }

    const usesProducts =
      Object.values(resolved.props).some(
        (schema) => schema.kind === "ref" && schema.refType === "product",
      ) ||
      resolved.previewsDeclareProducts ||
      resolved.usesProductHook;

    const manifest = {
      manifestVersion: COMPONENT_MANIFEST_VERSION,
      ...(resolved.title !== undefined ? { title: resolved.title } : {}),
      ...(resolved.description !== undefined ? { description: resolved.description } : {}),
      props,
      actions: resolved.actions,
      slot: resolved.slot,
      previewStates: resolved.previewNames.length > 0 ? resolved.previewNames : ["default"],
      hostData: usesProducts ? ["products"] : [],
    };
    return { manifest };
  } catch (err) {
    if (err instanceof StaticExtractError) {
      return { diagnostics: [{ message: err.message }] };
    }
    return { diagnostics: [{ message: err instanceof Error ? err.message : String(err) }] };
  }
}

/**
 * Rejects a prop/action literally named `id` — reserved for node identity.
 * Mirrors the runtime extractor's `assertReservedPropName`.
 */
function assertUsableName(name: string): void {
  if (name === "id") {
    bail('"id" is reserved for node identity and cannot be used as a prop or action name.');
  }
}

/** Rejects `p.select([])` (options must be non-empty), including array items. */
function assertSelectHasOptions(name: string, schema: StaticPropSchema): void {
  const empty = (s: StaticPropSchema | undefined): boolean =>
    s?.kind === "select" && (s.options === undefined || s.options.length === 0);
  if (empty(schema) || (schema.kind === "array" && empty(schema.item))) {
    bail(`prop "${name}" declares \`p.select([])\` with no options — select props need at least one option.`);
  }
}
