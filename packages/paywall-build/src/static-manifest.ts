import * as R from "effect/Record";
import * as P from "effect/Predicate";
import * as Arr from "effect/Array";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as Option from "effect/Option";
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
import * as Effect from "effect/Effect";
import * as EffectRuntime from "effect/Effect";
import ts from "typescript";
import { causeMessage, pick } from "@voidhash/lib/lang";
import { COMPONENT_MANIFEST_VERSION } from "@voidhash/paywalls/schema";
import type { ExtractOutcome } from "./types.ts";

/** The product-reading runtime hooks that imply `hostData: ["products"]`. */
const PRODUCT_HOOKS = HashSet.fromIterable([
  "usePaywallProducts",
  "useSelectedProduct",
  "usePaywallConfig",
]);

/** The SDK root specifier whose import bindings the render scan resolves. */
const SDK_SPECIFIER = "@voidhash/paywalls";

/**
 * The file's local bindings for `@voidhash/paywalls` exports: `named` maps each
 * local name to the SDK export it binds (`import { Slot as S }` ⇒ `S → Slot`);
 * `namespaces` holds namespace-import locals (`import * as P` ⇒ member access
 * `P.Slot` references the `Slot` export).
 */
interface SdkBindings {
  readonly named: HashMap.HashMap<string, string>;
  readonly namespaces: HashSet.HashSet<string>;
}

/** Collect the SDK import bindings declared by a source file. */
function sdkBindingsOf(file: ts.SourceFile): SdkBindings {
  return file.statements.reduce<SdkBindings>((collected, statement) => {
    if (!ts.isImportDeclaration(statement)) return collected;
    const spec = statement.moduleSpecifier;
    if (!ts.isStringLiteral(spec) || spec.text !== SDK_SPECIFIER) return collected;
    const bindings = statement.importClause?.namedBindings;
    if (!bindings) return collected;
    if (ts.isNamedImports(bindings)) {
      return {
        ...collected,
        named: bindings.elements.reduce(
          (named, element) =>
            HashMap.set(named, element.name.text, element.propertyName?.text ?? element.name.text),
          collected.named,
        ),
      };
    }
    return ts.isNamespaceImport(bindings)
      ? { ...collected, namespaces: HashSet.add(collected.namespaces, bindings.name.text) }
      : collected;
  }, { named: HashMap.empty(), namespaces: HashSet.empty() });
}

/**
 * True when an expression references the given SDK export through the file's
 * bindings: a (possibly aliased) named-import identifier, or a `P.<export>`
 * member access on a namespace import.
 */
function isSdkExportRef(expr: ts.Node, exported: string, bindings: SdkBindings): boolean {
  if (ts.isIdentifier(expr)) {
    return HashMap.get(bindings.named, expr.text).valueOrUndefined === exported;
  }
  if (ts.isPropertyAccessExpression(expr)) {
    return (
      ts.isIdentifier(expr.expression) &&
      HashSet.has(bindings.namespaces, expr.expression.text) &&
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
      usage.productHook ||= HashSet.some(PRODUCT_HOOKS, (hook) =>
        isSdkExportRef(node.expression, hook, bindings),
      );
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

/**
 * Fail with an author-facing message; caught and surfaced as diagnostics.
 *
 * The recursive-descent resolvers below use an aborting failure as control flow:
 * any construct outside the closed grammar abandons the whole extraction.
 * `Effect.runSync` of a defect raises the {@link StaticExtractError} instance
 * itself, which {@link staticExtractManifest}'s `Effect.try` boundary turns back
 * into diagnostics.
 */
function bail(detail: string): never {
  return EffectRuntime.runSync(
    Effect.die(
      new StaticExtractError(
        `${detail} Keep \`defineComponent\` declarative — props/actions must be a literal ` +
          "object of chained `p.*`/`a.*` builder calls with literal arguments so the " +
          "manifest can be derived without executing the component.",
      ),
    ),
  );
}

/** Unwrap `x as T` and `(x)` wrappers around an expression. */
function unwrap(expr: ts.Expression): ts.Expression {
  return ts.isAsExpression(expr) || ts.isParenthesizedExpression(expr)
    ? unwrap(expr.expression)
    : expr;
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
  if (!ts.isArrayLiteralExpression(node)) return bail(`${what} must be an array literal of strings.`);
  return node.elements.map((el) => {
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
  const visit = (
    node: ts.Expression,
    modifiers: ts.CallExpression[],
  ): { base: ts.CallExpression; modifiers: ts.CallExpression[] } => {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      !isFactoryRoot(node.expression)
    ) {
      return visit(unwrap(node.expression.expression), [node, ...modifiers]);
    }
    if (!ts.isCallExpression(node)) {
      return bail("A prop must be a `p.*()` builder call.");
    }
    return { base: node, modifiers };
  };
  return visit(unwrap(expr), []);
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
    return bail("A prop must be a `p.<kind>()` builder call.");
  }
  const method = callee.name.text;
  const kind = PROP_FACTORY_KINDS[method];
  if (kind === undefined) {
    return bail(`Unknown prop builder \`p.${method}(...)\`.`);
  }

  const schema: StaticPropSchema = { kind, hasDefault: false, optional: false };

  if (kind === "select") {
    const arg = base.arguments[0];
    if (arg === undefined) bail("`p.select(...)` requires an options array.");
    schema.options = stringLiteralArray(arg, "`p.select(...)` options");
  } else if (kind === "ref") {
    const arg = base.arguments[0];
    if (arg === undefined) return bail("`p.ref(...)` requires a string refType literal.");
    const value = literalValue(arg);
    if (!P.isString(value)) return bail("`p.ref(...)` requires a string refType literal.");
    schema.refType = value;
  } else if (kind === "array") {
    const arg = base.arguments[0];
    if (arg === undefined) bail("`p.array(...)` requires an item builder.");
    const item = resolvePropBuilder(arg);
    if (item.kind === "array") bail("`p.array(...)` items must be a non-array prop kind.");
    schema.item = item;
  }

  applyPropModifiers(schema, modifiers);
  return schema;
}

/** Apply the chained `.label()/.default()/.optional()/.editor()/.localizable()` modifiers. */
function applyPropModifiers(schema: StaticPropSchema, modifiers: ts.CallExpression[]): void {
  modifiers.forEach((modifier) => {
    const access = modifier.expression;
    if (!ts.isPropertyAccessExpression(access)) {
      bail("A prop modifier must be a method call.");
    }
    const name = access.name.text;
    if (name === "label") {
      const value = literalValue(requireArg(modifier, "`.label(...)`"));
      if (!P.isString(value)) bail("`.label(...)` requires a string literal.");
      schema.label = value;
    } else if (name === "default") {
      schema.defaultValue = literalValue(requireArg(modifier, "`.default(...)`"));
      schema.hasDefault = true;
    } else if (name === "editor") {
      const value = literalValue(requireArg(modifier, "`.editor(...)`"));
      if (!P.isString(value)) bail("`.editor(...)` requires a string literal.");
      schema.editor = value;
    } else if (name === "optional") {
      schema.optional = true;
    } else if (name === "localizable") {
      if (modifier.arguments[0] !== undefined) bail("`.localizable()` takes no arguments.");
      if (schema.kind !== "string" && schema.kind !== "image") {
        bail(`\`.localizable()\` is only valid on \`p.string()\`/\`p.image()\` props, not \`${schema.kind}\`.`);
      }
      schema.localizable = true;
    } else {
      bail(`Unknown prop modifier \`.${name}(...)\`.`);
    }
  });
}

/** The single argument of a modifier call, or `bail` when absent. */
function requireArg(call: ts.CallExpression, label: string): ts.Expression {
  const arg = call.arguments[0];
  if (arg === undefined) bail(`${label} requires an argument.`);
  return arg;
}

const isJsonScalar = (value: unknown): value is string | number | boolean =>
  P.isString(value) || P.isNumber(value) || P.isBoolean(value);

/** Defaults survive only when JSON-serializable losslessly (runtime parity). */
function serializableDefault(value: unknown): unknown {
  if (isJsonScalar(value)) return value;
  if (Array.isArray(value) && value.every(isJsonScalar)) return value;
  return undefined;
}

/** The manifest `default` of a prop schema, or `undefined` when it has none. */
function manifestDefault(schema: StaticPropSchema): unknown {
  if (!schema.hasDefault) return undefined;
  return serializableDefault(schema.defaultValue);
}

/** Lower a static array-item schema to the manifest array-item shape. */
function toManifestItem(item: StaticPropSchema): Record<string, unknown> {
  const lowered: Record<string, unknown> = { kind: item.kind };
  if (item.options) lowered.options = item.options;
  if (item.refType) lowered.refType = item.refType;
  if (item.editor) lowered.editor = item.editor;
  return lowered;
}

/** Lower a static prop schema to the manifest prop shape (runtime-identical). */
function toManifestProp(schema: StaticPropSchema): Record<string, unknown> {
  const lowered: Record<string, unknown> = { kind: schema.kind };
  if (schema.kind === "select" && schema.options) lowered.options = schema.options;
  if (schema.kind === "ref" && schema.refType) lowered.refType = schema.refType;
  if (schema.kind === "array" && schema.item) lowered.item = toManifestItem(schema.item);
  if (schema.label !== undefined) lowered.label = schema.label;
  const defaultValue = manifestDefault(schema);
  if (defaultValue !== undefined) lowered.default = defaultValue;
  if (schema.editor !== undefined) lowered.editor = schema.editor;
  if (schema.localizable) lowered.localizable = true;
  lowered.optional = schema.optional || schema.hasDefault;
  return lowered;
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
  const first = call.arguments[0];
  if (first === undefined) {
    return bail("`defineComponent(...)` must be called with an object literal.");
  }
  const arg = unwrap(first);
  if (!ts.isObjectLiteralExpression(arg)) {
    return bail("`defineComponent(...)` must be called with an object literal.");
  }
  return arg;
}

/** A property's name as a plain string, or `bail` for computed/spread names. */
function propertyName(prop: ts.ObjectLiteralElementLike): string {
  if (!ts.isPropertyAssignment(prop) && !ts.isMethodDeclaration(prop)) {
    return bail("A `defineComponent` field must be a plain property (no spread or shorthand).");
  }
  const name = prop.name;
  if (ts.isIdentifier(name) || ts.isStringLiteral(name)) return name.text;
  return bail("A `defineComponent` field name must be a plain identifier.");
}

/** The object literal an arrow-function builder body resolves to. */
function arrowBodyObject(body: ts.ConciseBody, field: string): ts.Expression {
  if (ts.isParenthesizedExpression(body)) return unwrap(body.expression);
  if (ts.isBlock(body)) return blockReturnObject(body, field);
  return body;
}

/** The arrow/function body of a `props`/`actions` builder callback, or `bail`. */
function builderArrowBody(value: ts.Expression, field: string): ts.ObjectLiteralExpression {
  const node = unwrap(value);
  if (!ts.isArrowFunction(node)) {
    return bail(`\`${field}\` must be an arrow function returning an object literal.`);
  }
  const objectExpr = arrowBodyObject(node.body, field);
  if (!ts.isObjectLiteralExpression(objectExpr)) {
    return bail(`\`${field}\` must return an object literal of builder calls.`);
  }
  return objectExpr;
}

/** The object literal returned by a single-`return` builder block body, or `bail`. */
function blockReturnObject(block: ts.Block, field: string): ts.Expression {
  const ret = block.statements.find(
    (s): s is ts.ReturnStatement => ts.isReturnStatement(s),
  );
  if (!ret?.expression) return bail(`\`${field}\` must return an object literal.`);
  return unwrap(ret.expression);
}

/** Resolve the `props` object into per-name static prop schemas. */
function resolveProps(objectExpr: ts.ObjectLiteralExpression): Record<string, StaticPropSchema> {
  return objectExpr.properties.reduce<Record<string, StaticPropSchema>>((props, member) => {
    if (!ts.isPropertyAssignment(member)) {
      return bail("Each prop must be a `name: p.*()` assignment.");
    }
    const name = propertyName(member);
    return { ...props, [name]: resolvePropBuilder(member.initializer) };
  }, {});
}

/** Resolve the `actions` object into per-name payload shapes. */
function resolveActions(
  objectExpr: ts.ObjectLiteralExpression,
): Record<string, { payload: Record<string, { kind: string }> }> {
  return objectExpr.properties.reduce<Record<string, { payload: Record<string, { kind: string }> }>>((actions, member) => {
    if (!ts.isPropertyAssignment(member)) {
      return bail("Each action must be a `name: a.action(...)` assignment.");
    }
    const name = propertyName(member);
    return { ...actions, [name]: { payload: resolveActionPayload(member.initializer) } };
  }, {});
}

/** Resolve one `a.action(...)` call into its payload field-kind map. */
function resolveActionPayload(expr: ts.Expression): Record<string, { kind: string }> {
  const node = unwrap(expr);
  if (
    !ts.isCallExpression(node) ||
    !ts.isPropertyAccessExpression(node.expression) ||
    node.expression.name.text !== "action"
  ) {
    return bail("Each action must be an `a.action(...)` call.");
  }
  const first = node.arguments[0];
  if (first === undefined) return {};
  const arg = unwrap(first);
  if (!ts.isObjectLiteralExpression(arg)) {
    return bail("`a.action(...)` payload must be an object literal of `a.string/number/boolean()`.");
  }
  return arg.properties.reduce<Record<string, { kind: string }>>((payload, member) => {
    if (!ts.isPropertyAssignment(member)) {
      return bail("An action payload field must be a `name: a.<kind>()` assignment.");
    }
    const name = propertyName(member);
    return { ...payload, [name]: { kind: actionPayloadKind(member.initializer) } };
  }, {});
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
    return bail("`previews` must be an object literal of named preview states.");
  }
  return node.properties.map((member) => {
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
  let renderNode = Option.none<ts.Node>();

  object.properties.forEach((member) => {
    const name = propertyName(member);
    if (name === "title") {
      resolved.title = asStringField(member, "title");
    } else if (name === "description") {
      resolved.description = asStringField(member, "description");
    } else if (name === "props") {
      resolved.props = resolveProps(builderArrowBody(builderField(member, "props"), "props"));
    } else if (name === "actions") {
      resolved.actions = resolveActions(
        builderArrowBody(builderField(member, "actions"), "actions"),
      );
    } else if (name === "previews" && ts.isPropertyAssignment(member)) {
      resolved.previewNames = previewNamesOf(member.initializer);
      resolved.previewsDeclareProducts = previewsDeclareProducts(member.initializer);
    } else if (name === "render") {
      renderNode = Option.some(ts.isPropertyAssignment(member) ? member.initializer : member);
    }
  });

  Option.map(renderNode, (node) => {
    const usage = scanRenderUsage(node, bindings);
    resolved.slot = usage.slot;
    resolved.usesProductHook = usage.productHook;
  });
  return resolved;
}

/**
 * The initializer of a `props`/`actions` builder field. A method shorthand
 * (`props(p) { … }`) is not an arrow function, so it degrades with the same
 * message {@link builderArrowBody} produces for any other non-arrow value.
 */
function builderField(member: ts.ObjectLiteralElementLike, field: string): ts.Expression {
  if (ts.isPropertyAssignment(member)) return member.initializer;
  return bail(`\`${field}\` must be an arrow function returning an object literal.`);
}

/** A `defineComponent` string field (`title`/`description`) literal, or `bail`. */
function asStringField(member: ts.ObjectLiteralElementLike, field: string): string {
  if (!ts.isPropertyAssignment(member)) {
    return bail(`\`${field}\` must be a string literal.`);
  }
  const value = literalValue(member.initializer);
  if (!P.isString(value)) bail(`\`${field}\` must be a string literal.`);
  return value;
}

/**
 * Find the `defineComponent(...)` call that a file default-exports, accepting
 * the same forms {@link validate.ts}'s `hasDefineComponentDefaultExport` does:
 * `export default defineComponent({...})`, a const-bound identifier exported as
 * default, and `export { X as default }`. Returns `null` when none is found.
 */
function findDefaultExportedDefineComponent(file: ts.SourceFile): Option.Option<ts.CallExpression> {
  const isDefineCall = (expr: Option.Option<ts.Expression>): Option.Option<ts.CallExpression> => {
    if (Option.isNone(expr)) return Option.none();
    const node = unwrap(expr.value);
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "defineComponent"
    ) {
      return Option.some(node);
    }
    return Option.none();
  };

  // `const X = defineComponent(...)` bindings, for indirect default exports.
  const bindings = file.statements.reduce((collected, statement) => {
    if (!ts.isVariableStatement(statement)) return collected;
    return statement.declarationList.declarations.reduce((current, declaration) => {
      if (!ts.isIdentifier(declaration.name)) return current;
      const bindingName = declaration.name.text;
      return Option.match(isDefineCall(Option.fromUndefinedOr(declaration.initializer)), {
        onNone: () => current,
        onSome: (call) => HashMap.set(current, bindingName, call),
      });
    }, collected);
  }, HashMap.empty<string, ts.CallExpression>());

  return Option.firstSomeOf(file.statements.map((statement) => {
    // `export default defineComponent(...)` / `export default X`
    if (ts.isExportAssignment(statement) && !statement.isExportEquals) {
      const direct = isDefineCall(Option.some(statement.expression));
      if (Option.isSome(direct)) return direct;
      if (ts.isIdentifier(statement.expression)) {
        return HashMap.get(bindings, statement.expression.text);
      }
    }
    // `export { X as default }`
    if (
      ts.isExportDeclaration(statement) &&
      statement.exportClause &&
      ts.isNamedExports(statement.exportClause)
    ) {
      return Option.firstSomeOf(statement.exportClause.elements.map((element) => {
        if (element.name.text !== "default") return Option.none<ts.CallExpression>();
        const local = element.propertyName?.text ?? element.name.text;
        return HashMap.get(bindings, local);
      }));
    }
    return Option.none<ts.CallExpression>();
  }));
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
  if (Option.isNone(call)) {
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

  // `bail` aborts the recursive descent with a raised StaticExtractError; this
  // boundary turns any such abort back into author-facing diagnostics.
  return EffectRuntime.runSync(
    Effect.try({
      try: () => lowerDefinition(call.value, file),
      catch: (cause) => cause,
    }).pipe(
      Effect.match({
        onSuccess: (manifest): ExtractOutcome => ({ manifest }),
        onFailure: (cause): ExtractOutcome => ({
          diagnostics: [{ message: causeMessage(cause) }],
        }),
      }),
    ),
  );
}

/** Resolve and lower the `defineComponent(...)` call into the raw manifest value. */
function lowerDefinition(call: ts.CallExpression, file: ts.SourceFile): Record<string, unknown> {
  const resolved = resolveDefinition(call, sdkBindingsOf(file));

  const props = R.toEntries(resolved.props).reduce<Record<string, unknown>>((manifestProps, [name, schema]) => {
    assertUsableName(name);
    assertSelectHasOptions(name, schema);
    return { ...manifestProps, [name]: toManifestProp(schema) };
  }, {});
  R.keys(resolved.actions).forEach(assertUsableName);

  const usesProducts =
    R.values(resolved.props).some(
      (schema) => schema.kind === "ref" && schema.refType === "product",
    ) ||
    resolved.previewsDeclareProducts ||
    resolved.usesProductHook;

  const manifest: Record<string, unknown> = { manifestVersion: COMPONENT_MANIFEST_VERSION };
  if (resolved.title !== undefined) manifest.title = resolved.title;
  if (resolved.description !== undefined) manifest.description = resolved.description;
  manifest.props = props;
  manifest.actions = resolved.actions;
  manifest.slot = resolved.slot;
  manifest.previewStates = Arr.match(resolved.previewNames, {
    onEmpty: () => ["default"],
    onNonEmpty: (names) => names,
  });
  manifest.hostData = pick(usesProducts, ["products"], []);
  return manifest;
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
  const empty = (candidate: StaticPropSchema): boolean =>
    candidate.kind === "select" &&
    Option.match(Option.fromUndefinedOr(candidate.options), {
      onNone: () => true,
      onSome: (options) => Arr.match(options, { onEmpty: () => true, onNonEmpty: () => false }),
    });
  if (
    empty(schema) ||
    (schema.kind === "array" && Option.exists(Option.fromUndefinedOr(schema.item), empty))
  ) {
    bail(`prop "${name}" declares \`p.select([])\` with no options — select props need at least one option.`);
  }
}
