import ts from "typescript";
import * as Arr from "effect/Array";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as Option from "effect/Option";
import type { ResolvedComponent } from "./imports.ts";
import type { BuildDiagnostic } from "./diagnostics.ts";
import { error } from "./diagnostics.ts";
import { basename } from "./paths.ts";

/**
 * Stage 6 — structural validation.
 *
 * Cheap, syntactic invariants that do not depend on compilation:
 * - duplicate or case-colliding canonical component paths (two files that would
 *   resolve to the same document path on a case-insensitive store);
 * - every component file default-exports a `defineComponent(...)` call (an AST
 *   scan — no execution).
 *
 * (Entry existence is checked earlier, in {@link buildPaywall}, since a missing
 * entry is the ONLY error and short-circuits every other stage.)
 */
export function validate(components: readonly ResolvedComponent[]): readonly BuildDiagnostic[] {
  // Case-insensitive path collision detection.
  const byLowerPath = components.reduce((paths, component) => {
    const key = component.path.toLowerCase();
    const bucket = HashMap.get(paths, key).valueOrUndefined ?? [];
    return HashMap.set(paths, key, [...bucket, component.path]);
  }, HashMap.empty<string, readonly string[]>());
  const collisionDiagnostics = [...byLowerPath].flatMap(([, paths]) => {
    if (paths[1] === undefined) return [];
    const unique = Arr.dedupe(paths);
    return unique.map((path) => error(path, "validate", collisionMessage(unique, path)));
  });

  // Default-export-defineComponent check.
  const exportDiagnostics = components.flatMap((component) =>
    hasDefineComponentDefaultExport(component)
      ? []
      : [
          error(
            component.path,
            "validate",
            "A component file must default-export the defineComponent call, e.g. " +
              "`export default defineComponent({ ... })` (a const bound to " +
              "`defineComponent(...)` and exported as default is also accepted). Do NOT " +
              "export `definition.component` — export the definition itself.",
          ),
        ],
  );

  return [...collisionDiagnostics, ...exportDiagnostics];
}

/**
 * The message for a colliding canonical path: an exact duplicate (one unique
 * spelling) reads differently from a case-insensitive collision between
 * distinct spellings.
 */
function collisionMessage(unique: readonly string[], path: string): string {
  if (unique[1] === undefined) return `Duplicate component path "${path}".`;
  const others = unique.filter((p) => p !== path).join(", ");
  return `Component path collides (case-insensitively) with: ${others}.`;
}

/**
 * True when the file has a `export default defineComponent(...)` (or
 * `export { X as default }` where `X = defineComponent(...)`). A syntactic AST
 * scan; never executes the file.
 */
function hasDefineComponentDefaultExport(component: ResolvedComponent): boolean {
  const file = ts.createSourceFile(
    basename(component.absPath),
    component.source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );

  const isDefineComponentCall = (expr: Option.Option<ts.Expression>): boolean => {
    if (Option.isNone(expr)) return false;
    // Unwrap `defineComponent(...) as X` / parenthesized forms.
    const unwrap = (node: ts.Expression): ts.Expression =>
      ts.isAsExpression(node) || ts.isParenthesizedExpression(node)
        ? unwrap(node.expression)
        : node;
    const node = unwrap(expr.value);
    return (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "defineComponent"
    );
  };

  // Track `const X = defineComponent(...)` for `export { X as default }`.
  const defineComponentBindings = file.statements.reduce((bindings, statement) => {
    if (!ts.isVariableStatement(statement)) return bindings;
    return statement.declarationList.declarations.reduce((current, declaration) => {
      if (
        ts.isIdentifier(declaration.name) &&
        isDefineComponentCall(Option.fromUndefinedOr(declaration.initializer))
      ) {
        return HashSet.add(current, declaration.name.text);
      }
      return current;
    }, bindings);
  }, HashSet.empty<string>());

  return file.statements.some((statement) => {
    // `export default defineComponent(...)`
    if (ts.isExportAssignment(statement) && !statement.isExportEquals) {
      if (isDefineComponentCall(Option.some(statement.expression))) return true;
      if (
        ts.isIdentifier(statement.expression) &&
        HashSet.has(defineComponentBindings, statement.expression.text)
      ) {
        return true;
      }
    }
    // `export { X as default }`
    if (
      ts.isExportDeclaration(statement) &&
      statement.exportClause &&
      ts.isNamedExports(statement.exportClause)
    ) {
      return statement.exportClause.elements.some((element) => {
        const exportedAs = element.name.text;
        const local = element.propertyName?.text ?? element.name.text;
        return exportedAs === "default" && HashSet.has(defineComponentBindings, local);
      });
    }
    return false;
  });
}
