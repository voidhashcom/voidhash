import ts from "typescript";
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
  const diagnostics: BuildDiagnostic[] = [];

  // Case-insensitive path collision detection.
  const byLowerPath = new Map<string, string[]>();
  for (const component of components) {
    const key = component.path.toLowerCase();
    const bucket = byLowerPath.get(key);
    if (bucket) bucket.push(component.path);
    else byLowerPath.set(key, [component.path]);
  }
  for (const [, paths] of byLowerPath) {
    if (paths.length > 1) {
      const unique = [...new Set(paths)];
      for (const path of unique) {
        diagnostics.push(error(path, "validate", collisionMessage(unique, path)));
      }
    }
  }

  // Default-export-defineComponent check.
  for (const component of components) {
    if (!hasDefineComponentDefaultExport(component)) {
      diagnostics.push(
        error(
          component.path,
          "validate",
          "A component file must default-export the defineComponent call, e.g. " +
            "`export default defineComponent({ ... })` (a const bound to " +
            "`defineComponent(...)` and exported as default is also accepted). Do NOT " +
            "export `definition.component` — export the definition itself.",
        ),
      );
    }
  }

  return diagnostics;
}

/**
 * The message for a colliding canonical path: an exact duplicate (one unique
 * spelling) reads differently from a case-insensitive collision between
 * distinct spellings.
 */
function collisionMessage(unique: readonly string[], path: string): string {
  if (unique.length === 1) return `Duplicate component path "${path}".`;
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

  const isDefineComponentCall = (expr: ts.Expression | undefined): boolean => {
    if (!expr) return false;
    // Unwrap `defineComponent(...) as X` / parenthesized forms.
    let node: ts.Expression = expr;
    while (ts.isAsExpression(node) || ts.isParenthesizedExpression(node)) {
      node = node.expression;
    }
    return (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "defineComponent"
    );
  };

  // Track `const X = defineComponent(...)` for `export { X as default }`.
  const defineComponentBindings = new Set<string>();
  for (const statement of file.statements) {
    if (ts.isVariableStatement(statement)) {
      for (const decl of statement.declarationList.declarations) {
        if (ts.isIdentifier(decl.name) && isDefineComponentCall(decl.initializer)) {
          defineComponentBindings.add(decl.name.text);
        }
      }
    }
  }

  for (const statement of file.statements) {
    // `export default defineComponent(...)`
    if (ts.isExportAssignment(statement) && !statement.isExportEquals) {
      if (isDefineComponentCall(statement.expression)) return true;
      if (
        ts.isIdentifier(statement.expression) &&
        defineComponentBindings.has(statement.expression.text)
      ) {
        return true;
      }
    }
    // `export { X as default }`
    if (ts.isExportDeclaration(statement) && statement.exportClause && ts.isNamedExports(statement.exportClause)) {
      for (const element of statement.exportClause.elements) {
        const exportedAs = element.name.text;
        const local = element.propertyName?.text ?? element.name.text;
        if (exportedAs === "default" && defineComponentBindings.has(local)) return true;
      }
    }
  }
  return false;
}
