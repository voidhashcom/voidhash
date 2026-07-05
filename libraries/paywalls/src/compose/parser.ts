import ts from "typescript";

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
  CompositionPropValue,
  CompositionScalarSource,
  CompositionStyleValue,
  CompositionVariable,
  CompositionVariableType,
} from "./ast";
import {
  arrayItemKey,
  registryByTag,
  variableTypeForPropKind,
  type CompositionActionDef,
  type CompositionComponent,
  type CompositionPropDef,
  type CompositionRegistry,
} from "./component";
import { CompositionError } from "./error";
import {
  styleFieldFor,
  styleFieldsOf,
  TAG_TO_TYPE,
  type CompositionNodeType,
} from "./grammar";

/** Options for {@link parseComposition}. */
export interface ParseCompositionOptions {
  /** Source file name used in error positions. Defaults to `paywall.tsx`. */
  readonly fileName?: string;
  /** Components a `<Component>` element may reference. Absent ⇒ layout-only grammar. */
  readonly registry?: CompositionRegistry;
}

/**
 * Parse a `.paywall.tsx` composition source into a public {@link CompositionAST}.
 *
 * The source is parsed with the real TypeScript/JSX parser; a whitelist walk
 * then lowers the closed element + expression grammar into AST nodes. Any
 * construct outside the grammar (arbitrary calls, member access, control flow,
 * template interpolation, …) raises a {@link CompositionError} — nothing is ever
 * executed. Mimic-free: the mimic document lowering lives in the closed
 * `paywall-composition` bridge, driven by this AST.
 */
export function parseComposition(
  source: string,
  options: ParseCompositionOptions = {},
): CompositionAST {
  const parser = new Parser(source, options.fileName ?? "paywall.tsx", options.registry);
  return parser.parse();
}

interface VarInfo {
  readonly name: string;
  readonly type: CompositionVariableType;
  /** Resolved declared default (undefined for product). */
  readonly defaultValue?: string | number | boolean;
}

const IDENTIFIER_PATTERN = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

class Parser {
  private readonly sf: ts.SourceFile;
  private readonly varsByBinding = new Map<string, VarInfo>();
  private readonly seenVariableNames = new Set<string>();
  private readonly componentsByTag: Map<string, CompositionComponent>;

  constructor(source: string, fileName: string, registry?: CompositionRegistry) {
    this.sf = ts.createSourceFile(
      fileName,
      source,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );
    this.componentsByTag = registry ? registryByTag(registry) : new Map();
  }

  parse(): CompositionAST {
    const paywallCall = this.findPaywallCall();
    const arrow = this.expectArrow(paywallCall);
    const rootJsx = this.readBodyAndVariables(arrow);

    const tag = this.tagName(rootJsx);
    if (tag !== "Screen") {
      throw this.error(rootJsx, `A paywall must return a <Screen>, got <${tag}>`);
    }

    const root = this.lowerElement(rootJsx);
    if (root.kind !== "element") {
      throw this.error(rootJsx, "A paywall must return a <Screen>");
    }
    return {
      variables: [...this.varsByBinding.values()].map((info) => ({
        name: info.name,
        type: info.type,
        ...(info.defaultValue !== undefined ? { defaultValue: info.defaultValue } : {}),
      })),
      root,
    };
  }

  // ---- top-level structure ------------------------------------------------

  private findPaywallCall(): ts.CallExpression {
    for (const statement of this.sf.statements) {
      if (ts.isExportAssignment(statement) && !statement.isExportEquals) {
        const expr = statement.expression;
        if (
          ts.isCallExpression(expr) &&
          ts.isIdentifier(expr.expression) &&
          expr.expression.text === "paywall"
        ) {
          return expr;
        }
        throw this.error(expr, "Default export must be paywall(() => <Screen/>)");
      }
    }
    throw this.error(this.sf, "Missing `export default paywall(() => …)`");
  }

  private expectArrow(call: ts.CallExpression): ts.ArrowFunction {
    const [arg] = call.arguments;
    if (!arg || !ts.isArrowFunction(arg) || call.arguments.length !== 1) {
      throw this.error(call, "paywall() takes a single arrow function");
    }
    return arg;
  }

  private readBodyAndVariables(arrow: ts.ArrowFunction): ts.JsxElement | ts.JsxSelfClosingElement {
    const body = arrow.body;
    if (ts.isBlock(body)) {
      let jsx: ts.JsxElement | ts.JsxSelfClosingElement | undefined;
      for (const statement of body.statements) {
        if (ts.isVariableStatement(statement)) {
          this.readVariableStatement(statement);
          continue;
        }
        if (ts.isReturnStatement(statement) && statement.expression) {
          jsx = this.unwrapJsx(statement.expression);
          continue;
        }
        throw this.error(statement, "Only variable declarations and a return are allowed here");
      }
      if (!jsx) {
        throw this.error(body, "paywall body must return a <Screen>");
      }
      return jsx;
    }
    return this.unwrapJsx(body);
  }

  private readVariableStatement(statement: ts.VariableStatement): void {
    if ((statement.declarationList.flags & ts.NodeFlags.Const) === 0) {
      throw this.error(statement, "Variable declarations must be `const`");
    }
    for (const decl of statement.declarationList.declarations) {
      if (!ts.isIdentifier(decl.name) || !decl.initializer) {
        throw this.error(decl, "Expected `const name = variable.<type>(...)`");
      }
      const info = this.readVariableInitializer(decl.initializer);
      // The variable name is its identity and, on print, its JS binding
      // identifier — so it must be a unique, valid identifier or the round-trip
      // breaks (duplicate ids / illegal duplicate `const`).
      if (!IDENTIFIER_PATTERN.test(info.name)) {
        throw this.error(decl, `Variable name "${info.name}" must be a valid identifier`);
      }
      if (this.seenVariableNames.has(info.name)) {
        throw this.error(decl, `Duplicate variable name "${info.name}"`);
      }
      this.seenVariableNames.add(info.name);
      this.varsByBinding.set(decl.name.text, info);
    }
  }

  private readVariableInitializer(expr: ts.Expression): VarInfo {
    if (
      !ts.isCallExpression(expr) ||
      !ts.isPropertyAccessExpression(expr.expression) ||
      !ts.isIdentifier(expr.expression.expression) ||
      expr.expression.expression.text !== "variable"
    ) {
      throw this.error(expr, 'Expected `variable.<type>("name", opts?)`');
    }
    const type = expr.expression.name.text;
    if (type !== "string" && type !== "number" && type !== "boolean" && type !== "product") {
      throw this.error(expr, `Unknown variable type "${type}"`);
    }
    const [nameArg, optsArg] = expr.arguments;
    if (!nameArg || !ts.isStringLiteral(nameArg)) {
      throw this.error(expr, "variable() requires a string name");
    }
    const name = nameArg.text;
    return { name, type, defaultValue: this.readVariableDefault(type, optsArg) };
  }

  private readVariableDefault(
    type: CompositionVariableType,
    optsArg: ts.Expression | undefined,
  ): string | number | boolean | undefined {
    if (!optsArg) {
      // `product` has no default value; the scalar types use their zero value.
      return type === "product" ? undefined : defaultVariableValue(type);
    }
    if (!ts.isObjectLiteralExpression(optsArg)) {
      throw this.error(optsArg, "variable() options must be an object literal");
    }
    // A product variable accepts no options — any provided `default` (or any
    // other key) is rejected here, matching the grammar's author surface which
    // gives `variable.product` no options parameter.
    for (const prop of optsArg.properties) {
      if (
        !ts.isPropertyAssignment(prop) ||
        !ts.isIdentifier(prop.name) ||
        prop.name.text !== "default"
      ) {
        throw this.error(prop, 'Only a "default" option is supported');
      }
      const init = prop.initializer;
      if (type === "string" && ts.isStringLiteral(init)) {
        return init.text;
      }
      if (type === "number" && ts.isNumericLiteral(init)) {
        return Number(init.text);
      }
      const bool = readBooleanLiteral(init);
      if (type === "boolean" && bool !== undefined) {
        return bool;
      }
      throw this.error(init, `Invalid default for a ${type} variable`);
    }
    return type === "product" ? undefined : defaultVariableValue(type);
  }

  // ---- element lowering ---------------------------------------------------

  private lowerElement(el: ts.JsxElement | ts.JsxSelfClosingElement): CompositionNode {
    const tag = this.tagName(el);
    const type = TAG_TO_TYPE[tag];
    if (!type) {
      const component = this.componentsByTag.get(tag);
      if (component) {
        return this.lowerComponent(el, component);
      }
      throw this.error(el, `Unknown element <${tag}>`);
    }

    let id: string | undefined;
    let name: string | undefined;
    const style: Record<string, CompositionStyleValue> = {};
    const interactions: CompositionInteraction[] = [];

    for (const attr of this.attributesOf(el)) {
      const attrName = attr.name.getText(this.sf);
      // `id` is HARD-reserved: it always maps to the node id, never a prop.
      if (attrName === "id") {
        id = this.expectStringAttr(attr);
        continue;
      }
      if (attrName === "name") {
        name = this.expectStringAttr(attr);
        continue;
      }
      if (attrName === "onPress") {
        if (type !== "view") {
          throw this.error(attr, "onPress is only supported on <View>");
        }
        interactions.push({ trigger: "click", action: this.readAction(this.expectExpr(attr)) });
        continue;
      }
      if (attrName === "style") {
        this.readStyleObject(attr, type, style);
        continue;
      }
      // A former FLAT style attribute is now a hard error that guides the author
      // to the single `style={{ … }}` object; any other unknown attribute keeps
      // the generic message.
      if (styleFieldFor(type, attrName)) {
        throw this.error(
          attr,
          `Style attributes are now written in a single style={{ … }} object — move "${attrName}" into style`,
        );
      }
      throw this.error(attr, `Unknown attribute "${attrName}" on <${this.tagName2(type)}>`);
    }

    const node: CompositionElementNode = {
      kind: "element",
      type,
      ...(id !== undefined ? { id } : {}),
      ...(name !== undefined ? { name } : {}),
      style,
      interactions,
      ...(type === "text"
        ? { text: this.readTextContent(el), children: [] }
        : { children: this.lowerChildren(el) }),
    };
    return node;
  }

  private lowerChildren(el: ts.JsxElement | ts.JsxSelfClosingElement): CompositionNode[] {
    const children: CompositionNode[] = [];
    if (ts.isJsxSelfClosingElement(el)) {
      return children;
    }
    for (const child of el.children) {
      if (ts.isJsxText(child)) {
        if (child.text.trim().length > 0) {
          throw this.error(child, "Text must be wrapped in a <Text> element");
        }
        continue;
      }
      if (ts.isJsxExpression(child)) {
        if (child.expression) {
          throw this.error(child, "Expressions are not allowed as layout children");
        }
        continue; // {/* comment */}
      }
      if (ts.isJsxElement(child) || ts.isJsxSelfClosingElement(child)) {
        children.push(this.lowerElement(child));
        continue;
      }
      throw this.error(child, "Unsupported child");
    }
    return children;
  }

  private readTextContent(el: ts.JsxElement | ts.JsxSelfClosingElement): string {
    if (ts.isJsxSelfClosingElement(el)) {
      return "";
    }
    const parts: string[] = [];
    for (const child of el.children) {
      if (ts.isJsxText(child)) {
        const trimmed = child.text.trim();
        if (trimmed.length > 0) {
          parts.push(trimmed);
        }
        continue;
      }
      if (ts.isJsxExpression(child)) {
        if (!child.expression) {
          continue; // {/* comment */}
        }
        // A single string-literal expression is the printer's escape hatch for
        // text with whitespace or JSX-special characters — exact, not trimmed.
        if (ts.isStringLiteral(child.expression)) {
          return child.expression.text;
        }
        throw this.error(
          child,
          "Variable-bound text is not yet supported — bind through a code component instead",
        );
      }
      throw this.error(child, "<Text> may only contain literal text");
    }
    return parts.join(" ");
  }

  // ---- code-component instances -------------------------------------------

  /**
   * Lower a `<Component …>` element to a `component` AST node. The tag resolves
   * to a registry entry; attributes map to `props` (manifest prop names) or
   * `actionBindings` (manifest action names); children are slot content.
   */
  private lowerComponent(
    el: ts.JsxElement | ts.JsxSelfClosingElement,
    component: CompositionComponent,
  ): CompositionComponentNode {
    const manifest = component.manifest;
    let id: string | undefined;
    let name: string | undefined;
    const propByName = new Map<string, CompositionPropValue>();
    const actionByName = new Map<string, CompositionAction>();

    for (const attr of this.attributesOf(el)) {
      const attrName = attr.name.getText(this.sf);
      // `id` is HARD-reserved on component tags too: it is unconditionally the
      // node id, never a prop. Unlike `name`, a manifest prop literally named
      // "id" cannot win the slot — the registry rejects such manifests up front.
      if (attrName === "id") {
        id = this.expectStringAttr(attr);
        continue;
      }
      // `name` is the reserved instance display-name attribute — UNLESS the
      // component declares a prop literally named "name", in which case the
      // functional prop wins the single `name=` slot (a manifest prop named
      // "name" is legal and must not be silently dropped).
      if (attrName === "name" && manifest.props["name"] === undefined) {
        name = this.expectStringAttr(attr);
        continue;
      }
      const actionDef = manifest.actions?.[attrName];
      if (actionDef) {
        actionByName.set(attrName, this.readComponentAction(this.expectExpr(attr), actionDef));
        continue;
      }
      const propDef = manifest.props[attrName];
      if (propDef) {
        propByName.set(attrName, this.readPropBinding(attr, propDef, attrName));
        continue;
      }
      throw this.error(attr, `Unknown prop "${attrName}" on <${component.tag}>`);
    }

    // Emit props/actionBindings in MANIFEST declaration order (not source
    // order), matching the printer. This keeps the stored order canonical so a
    // no-op round-trip reconciles to zero commands regardless of the order the
    // author wrote the attributes in.
    const props: CompositionPropBinding[] = Object.keys(manifest.props)
      .filter((propName) => propByName.has(propName))
      .map((propName) => ({ name: propName, value: propByName.get(propName)! }));
    const actionBindings: CompositionActionBinding[] = Object.keys(manifest.actions ?? {})
      .filter((actionName) => actionByName.has(actionName))
      .map((actionName) => ({ name: actionName, action: actionByName.get(actionName)! }));

    const children = this.lowerChildren(el);
    if (children.length > 0 && !manifest.slot) {
      throw this.error(el, `<${component.tag}> does not declare a slot and cannot have children`);
    }

    return {
      kind: "component",
      tag: component.tag,
      ...(id !== undefined ? { id } : {}),
      ...(name !== undefined ? { name } : {}),
      props,
      actionBindings,
      children,
    };
  }

  /** A component prop binding: a variable reference (`prop={someVar}`) or a literal. */
  private readPropBinding(
    attr: ts.JsxAttribute,
    propDef: CompositionPropDef,
    propName: string,
  ): CompositionPropValue {
    const init = attr.initializer;
    if (init && ts.isJsxExpression(init) && init.expression && ts.isIdentifier(init.expression)) {
      const variable = this.resolveVar(init.expression);
      const expected = variableTypeForPropKind(propDef.kind);
      if (!expected) {
        throw this.error(
          attr,
          `Prop "${propName}" of kind ${propDef.kind} cannot be bound to a variable`,
        );
      }
      if (variable.type !== expected) {
        throw this.error(
          attr,
          `Prop "${propName}" expects a ${expected} variable but "${variable.name}" is a ${variable.type}`,
        );
      }
      return { kind: "variable", variableName: variable.name };
    }
    return this.readPropValue(attr, propDef, propName);
  }

  private readPropValue(
    attr: ts.JsxAttribute,
    propDef: CompositionPropDef,
    propName: string,
  ): CompositionPropValue {
    switch (propDef.kind) {
      case "string":
      case "select":
      case "image": {
        const value = this.expectStringValue(attr);
        if (propDef.kind === "select" && propDef.options && !propDef.options.includes(value)) {
          throw this.error(attr, `"${value}" is not a valid option for "${propName}"`);
        }
        return { kind: "literal-string", value };
      }
      case "number":
        return { kind: "literal-number", value: this.expectNumberValue(attr) };
      case "boolean":
        return { kind: "literal-boolean", value: this.expectBooleanValue(attr) };
      case "ref":
        return {
          kind: "literal-product",
          productId: this.readProductLiteral(this.expectExpr(attr)),
        };
      case "array": {
        const key = arrayItemKey(propDef.item?.kind);
        if (!key || !propDef.item) {
          throw this.error(attr, `Array prop "${propName}" has an unsupported item kind`);
        }
        const value = this.readArrayLiteral(attr, propDef.item.kind, propName);
        if (key === "number-array") {
          return { kind: "literal-number-array", value: value as number[] };
        }
        if (key === "boolean-array") {
          return { kind: "literal-boolean-array", value: value as boolean[] };
        }
        return { kind: "literal-string-array", value: value as string[] };
      }
      case "component":
        throw this.error(
          attr,
          `Component-valued prop "${propName}" is not supported in composition`,
        );
    }
  }

  /** Read an action bound to a component action (extends node actions with `none`/`payload`). */
  private readComponentAction(
    expr: ts.Expression,
    actionDef: CompositionActionDef,
  ): CompositionAction {
    if (!ts.isCallExpression(expr)) {
      throw this.error(
        expr,
        "Expected an action, e.g. purchase(...), closePaywall(), none(), or x.set(...)",
      );
    }
    if (ts.isIdentifier(expr.expression)) {
      const fn = expr.expression.text;
      if (fn === "closePaywall") {
        return { kind: "close-paywall" };
      }
      if (fn === "none") {
        return { kind: "none" };
      }
      if (fn === "purchase") {
        return {
          kind: "purchase",
          product: this.readComponentProductSource(this.singleArg(expr), actionDef),
        };
      }
      throw this.error(expr, `Unknown action "${fn}"`);
    }
    if (
      ts.isPropertyAccessExpression(expr.expression) &&
      ts.isIdentifier(expr.expression.expression) &&
      expr.expression.name.text === "set"
    ) {
      const variable = this.resolveVar(expr.expression.expression);
      return {
        kind: "set-variable",
        variableName: variable.name,
        value: this.readComponentActionValueSource(this.singleArg(expr), variable.type, actionDef),
      };
    }
    throw this.error(expr, "Unsupported action expression");
  }

  private readComponentProductSource(
    expr: ts.Expression,
    actionDef: CompositionActionDef,
  ): CompositionProductSource {
    const field = this.readPayloadAccess(expr, actionDef);
    if (field) {
      return { kind: "payload", field };
    }
    if (ts.isIdentifier(expr)) {
      const variable = this.resolveVar(expr);
      if (variable.type !== "product") {
        throw this.error(expr, `Variable "${variable.name}" is not a product`);
      }
      return { kind: "variable", variableName: variable.name };
    }
    return { kind: "literal", productId: this.readProductLiteral(expr) };
  }

  private readComponentActionValueSource(
    expr: ts.Expression,
    expectedType: CompositionVariableType,
    actionDef: CompositionActionDef,
  ): CompositionScalarSource {
    const field = this.readPayloadAccess(expr, actionDef);
    if (field) {
      return { kind: "payload", field };
    }
    return this.readScalarSourceCommon(expr, expectedType);
  }

  /** Recognize `payload("field")` and validate the field against the action's payload. */
  private readPayloadAccess(expr: ts.Expression, actionDef: CompositionActionDef): string | null {
    if (
      !ts.isCallExpression(expr) ||
      !ts.isIdentifier(expr.expression) ||
      expr.expression.text !== "payload"
    ) {
      return null;
    }
    const arg = this.singleArg(expr);
    if (!ts.isStringLiteral(arg)) {
      throw this.error(expr, "payload() requires a string field name");
    }
    if (!(arg.text in actionDef.payload)) {
      throw this.error(expr, `Unknown payload field "${arg.text}"`);
    }
    return arg.text;
  }

  // ---- actions ------------------------------------------------------------

  private readAction(expr: ts.Expression): CompositionAction {
    if (!ts.isCallExpression(expr)) {
      throw this.error(expr, "Expected an action, e.g. purchase(...), closePaywall(), or none()");
    }
    if (ts.isIdentifier(expr.expression)) {
      const fn = expr.expression.text;
      if (fn === "closePaywall") {
        return { kind: "close-paywall" };
      }
      // Mirror `readComponentAction`: a designer-authored `<View onPress>` with a
      // fresh (`{type:"none"}`) interaction lifts + prints to `onPress={none()}`,
      // so the node-level grammar must parse `none()` back for the round trip.
      if (fn === "none") {
        return { kind: "none" };
      }
      if (fn === "purchase") {
        return { kind: "purchase", product: this.readProductSource(this.singleArg(expr)) };
      }
      throw this.error(expr, `Unknown action "${fn}"`);
    }
    if (
      ts.isPropertyAccessExpression(expr.expression) &&
      ts.isIdentifier(expr.expression.expression) &&
      expr.expression.name.text === "set"
    ) {
      const variable = this.resolveVar(expr.expression.expression);
      return {
        kind: "set-variable",
        variableName: variable.name,
        value: this.readActionValueSource(this.singleArg(expr), variable.type),
      };
    }
    throw this.error(expr, "Unsupported action expression");
  }

  private readProductSource(expr: ts.Expression): CompositionProductSource {
    if (ts.isIdentifier(expr)) {
      const variable = this.resolveVar(expr);
      if (variable.type !== "product") {
        throw this.error(expr, `Variable "${variable.name}" is not a product`);
      }
      return { kind: "variable", variableName: variable.name };
    }
    return { kind: "literal", productId: this.readProductLiteral(expr) };
  }

  private readActionValueSource(
    expr: ts.Expression,
    expectedType: CompositionVariableType,
  ): CompositionScalarSource {
    return this.readScalarSourceCommon(expr, expectedType);
  }

  /** Shared scalar source reading for node + component set-variable actions. */
  private readScalarSourceCommon(
    expr: ts.Expression,
    expectedType: CompositionVariableType,
  ): CompositionScalarSource {
    if (ts.isIdentifier(expr)) {
      const variable = this.resolveVar(expr);
      this.expectType(expr, variable.type, expectedType);
      return { kind: "variable", variableName: variable.name };
    }
    if (
      ts.isCallExpression(expr) &&
      ts.isIdentifier(expr.expression) &&
      expr.expression.text === "product"
    ) {
      this.expectType(expr, "product", expectedType);
      return { kind: "literal-product", productId: this.readProductLiteral(expr) };
    }
    if (ts.isStringLiteral(expr)) {
      this.expectType(expr, "string", expectedType);
      return { kind: "literal-string", value: expr.text };
    }
    const num = readNumericLiteral(expr);
    if (num !== undefined) {
      this.expectType(expr, "number", expectedType);
      return { kind: "literal-number", value: num };
    }
    const bool = readBooleanLiteral(expr);
    if (bool !== undefined) {
      this.expectType(expr, "boolean", expectedType);
      return { kind: "literal-boolean", value: bool };
    }
    throw this.error(expr, "Unsupported action value");
  }

  /** Reject a set-variable value whose type doesn't match the target variable. */
  private expectType(
    node: ts.Node,
    actual: CompositionVariableType,
    expected: CompositionVariableType,
  ): void {
    if (actual !== expected) {
      throw this.error(node, `Expected a ${expected} value but got ${actual}`);
    }
  }

  private readProductLiteral(expr: ts.Expression): string {
    if (
      !ts.isCallExpression(expr) ||
      !ts.isIdentifier(expr.expression) ||
      expr.expression.text !== "product"
    ) {
      throw this.error(expr, 'Expected product("id")');
    }
    const [arg] = expr.arguments;
    if (!arg || !ts.isStringLiteral(arg)) {
      throw this.error(expr, "product() requires a string id");
    }
    return arg.text;
  }

  // ---- value readers ------------------------------------------------------

  /**
   * Read a `style={{ … }}` attribute into the node's style record. The initializer
   * must be a JSX expression wrapping an object literal; each property's key must
   * be a legal style field for this node type (else a did-you-mean error), and its
   * value is read with {@link readJsonLiteral} (scalars incl. negative numbers,
   * strings, booleans, and nested gradient/image objects/arrays). Duplicate keys,
   * spreads, shorthands, and computed property names are hard errors. An empty
   * object (`style={{}}`) is legal and contributes nothing.
   */
  private readStyleObject(
    attr: ts.JsxAttribute,
    type: CompositionNodeType,
    style: Record<string, CompositionStyleValue>,
  ): void {
    const init = attr.initializer;
    if (!init || !ts.isJsxExpression(init) || !init.expression) {
      throw this.error(attr, "style expects an object literal, e.g. style={{ paddingTop: 16 }}");
    }
    const expr = init.expression;
    if (!ts.isObjectLiteralExpression(expr)) {
      throw this.error(expr, "style expects an object literal, e.g. style={{ paddingTop: 16 }}");
    }
    const fields = styleFieldsOf(type);
    for (const property of expr.properties) {
      if (!ts.isPropertyAssignment(property)) {
        throw this.error(
          property,
          "Only plain key: value style properties are allowed — no shorthands, spreads, or methods",
        );
      }
      const nameNode = property.name;
      let key: string;
      if (ts.isIdentifier(nameNode) || ts.isStringLiteral(nameNode)) {
        key = nameNode.text;
      } else {
        throw this.error(nameNode, "Style keys must be plain identifiers or string literals");
      }
      if (!fields.has(key)) {
        throw this.error(nameNode, this.unknownStyleKeyMessage(key, type));
      }
      if (Object.hasOwn(style, key)) {
        throw this.error(nameNode, `Duplicate style key "${key}"`);
      }
      style[key] = this.readJsonLiteral(property.initializer);
    }
  }

  /** An "unknown style key" message with a nearest-field did-you-mean suggestion. */
  private unknownStyleKeyMessage(key: string, type: CompositionNodeType): string {
    const suggestion = nearestField(key, [...styleFieldsOf(type)]);
    const base = `Unknown style key "${key}" on <${this.tagName2(type)}>`;
    return suggestion ? `${base} — did you mean "${suggestion}"?` : base;
  }

  /**
   * Reads a JSON-literal expression (object/array/string/number/boolean, nested)
   * into plain data. Rejects anything non-literal — identifiers, spreads,
   * computed/shorthand keys, method/accessor members, function calls — with a
   * clear error so structured style values stay serializable JSON.
   */
  private readJsonLiteral(expr: ts.Expression): CompositionStyleValue {
    if (ts.isStringLiteral(expr)) {
      return expr.text;
    }
    const num = readNumericLiteral(expr);
    if (num !== undefined) {
      return num;
    }
    const bool = readBooleanLiteral(expr);
    if (bool !== undefined) {
      return bool;
    }
    if (ts.isArrayLiteralExpression(expr)) {
      return expr.elements.map((element) => {
        if (ts.isSpreadElement(element)) {
          throw this.error(element, "Spread elements are not allowed in a style value");
        }
        return this.readJsonLiteral(element);
      });
    }
    if (ts.isObjectLiteralExpression(expr)) {
      const out: Record<string, CompositionStyleValue> = {};
      for (const property of expr.properties) {
        if (!ts.isPropertyAssignment(property)) {
          throw this.error(
            property,
            "Only plain key: value properties are allowed in a style value",
          );
        }
        const nameNode = property.name;
        let key: string;
        if (ts.isIdentifier(nameNode)) {
          key = nameNode.text;
        } else if (ts.isStringLiteral(nameNode)) {
          key = nameNode.text;
        } else {
          throw this.error(nameNode, "Style value keys must be plain identifiers or strings");
        }
        out[key] = this.readJsonLiteral(property.initializer);
      }
      return out;
    }
    throw this.error(
      expr,
      "Style values may only contain literal strings, numbers, booleans, objects, and arrays",
    );
  }

  /** The expression inside a `{…}` attribute initializer, or undefined. */
  private attrExpr(attr: ts.JsxAttribute): ts.Expression | undefined {
    const init = attr.initializer;
    return init && ts.isJsxExpression(init) && init.expression ? init.expression : undefined;
  }

  private expectStringValue(attr: ts.JsxAttribute): string {
    const init = attr.initializer;
    if (init && ts.isStringLiteral(init)) {
      return init.text;
    }
    const expr = this.attrExpr(attr);
    if (expr && ts.isStringLiteral(expr)) {
      return expr.text;
    }
    throw this.error(attr, `Prop "${attr.name.getText(this.sf)}" expects a string`);
  }

  private expectNumberValue(attr: ts.JsxAttribute): number {
    const expr = this.attrExpr(attr);
    if (expr) {
      const num = readNumericLiteral(expr);
      if (num !== undefined) {
        return num;
      }
    }
    throw this.error(attr, `Prop "${attr.name.getText(this.sf)}" expects a number`);
  }

  private expectBooleanValue(attr: ts.JsxAttribute): boolean {
    if (!attr.initializer) {
      return true; // bare flag, e.g. featured
    }
    const expr = this.attrExpr(attr);
    if (expr) {
      const bool = readBooleanLiteral(expr);
      if (bool !== undefined) {
        return bool;
      }
    }
    throw this.error(attr, `Prop "${attr.name.getText(this.sf)}" expects a boolean`);
  }

  private readArrayLiteral(
    attr: ts.JsxAttribute,
    itemKind: CompositionPropDef["kind"],
    propName: string,
  ): (string | number | boolean)[] {
    const expr = this.attrExpr(attr);
    if (!expr || !ts.isArrayLiteralExpression(expr)) {
      throw this.error(attr, `Prop "${propName}" expects an array literal`);
    }
    return expr.elements.map((element) => {
      if (itemKind === "number") {
        const num = readNumericLiteral(element);
        if (num !== undefined) {
          return num;
        }
        throw this.error(element, `Array items in "${propName}" must be numbers`);
      }
      if (itemKind === "boolean") {
        const bool = readBooleanLiteral(element);
        if (bool !== undefined) {
          return bool;
        }
        throw this.error(element, `Array items in "${propName}" must be booleans`);
      }
      if (ts.isStringLiteral(element)) {
        return element.text;
      }
      throw this.error(element, `Array items in "${propName}" must be strings`);
    });
  }

  private resolveVar(ident: ts.Identifier): VarInfo {
    const info = this.varsByBinding.get(ident.text);
    if (!info) {
      throw this.error(ident, `Unknown variable "${ident.text}"`);
    }
    return info;
  }

  // ---- small helpers ------------------------------------------------------

  private singleArg(call: ts.CallExpression): ts.Expression {
    const [arg] = call.arguments;
    if (!arg || call.arguments.length !== 1) {
      throw this.error(call, "Expected exactly one argument");
    }
    return arg;
  }

  private expectExpr(attr: ts.JsxAttribute): ts.Expression {
    if (
      !attr.initializer ||
      !ts.isJsxExpression(attr.initializer) ||
      !attr.initializer.expression
    ) {
      throw this.error(attr, `Attribute "${attr.name.getText(this.sf)}" expects an expression`);
    }
    return attr.initializer.expression;
  }

  private expectStringAttr(attr: ts.JsxAttribute): string {
    if (attr.initializer && ts.isStringLiteral(attr.initializer)) {
      return attr.initializer.text;
    }
    throw this.error(attr, `Attribute "${attr.name.getText(this.sf)}" expects a string`);
  }

  private tagName(el: ts.JsxElement | ts.JsxSelfClosingElement): string {
    const tagNode = ts.isJsxElement(el) ? el.openingElement.tagName : el.tagName;
    return tagNode.getText(this.sf);
  }

  private tagName2(type: CompositionNodeType): string {
    return type.charAt(0).toUpperCase() + type.slice(1);
  }

  private attributesOf(el: ts.JsxElement | ts.JsxSelfClosingElement): ts.JsxAttribute[] {
    const attrs = ts.isJsxElement(el) ? el.openingElement.attributes : el.attributes;
    return attrs.properties.map((prop) => {
      if (!ts.isJsxAttribute(prop)) {
        throw this.error(prop, "Spread attributes are not allowed");
      }
      return prop;
    });
  }

  private unwrapJsx(expr: ts.Expression): ts.JsxElement | ts.JsxSelfClosingElement {
    let current = expr;
    while (ts.isParenthesizedExpression(current)) {
      current = current.expression;
    }
    if (ts.isJsxElement(current) || ts.isJsxSelfClosingElement(current)) {
      return current;
    }
    throw this.error(expr, "Expected a JSX element");
  }

  private error(node: ts.Node, message: string): CompositionError {
    const pos = this.sf.getLineAndCharacterOfPosition(node.getStart(this.sf));
    return new CompositionError(message, pos.line, pos.character);
  }
}

/**
 * The nearest field name to `key` by Levenshtein edit distance, for a
 * did-you-mean suggestion. Returns the closest candidate only when the distance
 * is small relative to the key length (a distant typo gets no suggestion).
 */
function nearestField(key: string, candidates: readonly string[]): string | undefined {
  let best: string | undefined;
  let bestDistance = Infinity;
  for (const candidate of candidates) {
    const distance = editDistance(key, candidate);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = candidate;
    }
  }
  // Only suggest when the edit distance is at most a third of the key length
  // (rounded up, minimum 2) — enough to catch a transposition or a dropped/extra
  // character, but not to guess wildly for an unrelated word.
  const threshold = Math.max(2, Math.ceil(key.length / 3));
  return best !== undefined && bestDistance <= threshold ? best : undefined;
}

/** Iterative Levenshtein edit distance between two strings. */
function editDistance(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  let prev = Array.from({ length: cols }, (_, index) => index);
  for (let i = 1; i < rows; i += 1) {
    const current = [i, ...new Array<number>(cols - 1).fill(0)];
    for (let j = 1; j < cols; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(prev[j]! + 1, current[j - 1]! + 1, prev[j - 1]! + cost);
    }
    prev = current;
  }
  return prev[cols - 1]!;
}

function readBooleanLiteral(expr: ts.Expression): boolean | undefined {
  if (expr.kind === ts.SyntaxKind.TrueKeyword) {
    return true;
  }
  if (expr.kind === ts.SyntaxKind.FalseKeyword) {
    return false;
  }
  return undefined;
}

/** A numeric literal, including a negated one (`-4` parses as unary minus). */
function readNumericLiteral(expr: ts.Expression): number | undefined {
  if (ts.isNumericLiteral(expr)) {
    return Number(expr.text);
  }
  if (ts.isPrefixUnaryExpression(expr) && ts.isNumericLiteral(expr.operand)) {
    if (expr.operator === ts.SyntaxKind.MinusToken) {
      return -Number(expr.operand.text);
    }
    if (expr.operator === ts.SyntaxKind.PlusToken) {
      return Number(expr.operand.text);
    }
  }
  return undefined;
}

function defaultVariableValue(type: "string" | "number" | "boolean"): string | number | boolean {
  switch (type) {
    case "string":
      return "";
    case "number":
      return 0;
    case "boolean":
      return false;
  }
}
