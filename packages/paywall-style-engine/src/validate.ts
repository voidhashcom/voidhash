import type { NodeType } from "@voidhash/mimic-schema";

import {
  acceptanceOf,
  expectedTypeLabel,
  nodeStyleFields,
  styleFieldSchema,
} from "./introspection.ts";
import { errorDiagnostic, type StyleDiagnostic } from "./diagnostics.ts";
import type { StylePatch } from "./model.ts";

/**
 * Validates a style patch against a node type's live schema, converting the
 * document layer's two silent failure modes into synchronous, field-pathed
 * diagnostics: an unknown field (which the server sanitizer would silently
 * strip) and a wrong-family value (which would reject the whole transaction
 * late, after the optimistic write already rendered).
 *
 * Field deletions (`undefined`) are always legal — absence is a valid state for
 * every optional style field. Collects ALL findings rather than failing fast.
 */
export function validateStylePatch(
  nodeType: NodeType,
  patch: StylePatch,
  nodeId?: string,
): StyleDiagnostic[] {
  const diagnostics: StyleDiagnostic[] = [];
  const legalFields = nodeStyleFields(nodeType);

  for (const [field, value] of Object.entries(patch)) {
    if (!legalFields.includes(field)) {
      diagnostics.push(
        errorDiagnostic(
          "unknown-field",
          `"${field}" is not a style field of ${nodeType} nodes; the document would silently drop it`,
          { nodeId, field },
        ),
      );
      continue;
    }
    if (value === undefined) continue;

    const schema = styleFieldSchema(nodeType, field);
    if (schema === undefined) continue;
    const acc = acceptanceOf(schema);

    if (typeof value === "number") {
      if (!Number.isFinite(value)) {
        diagnostics.push(
          errorDiagnostic("invalid-value", `"${field}" must be a finite number`, {
            nodeId,
            field,
          }),
        );
        continue;
      }
      if (!acc.acceptsNumber && !acc.literals.includes(value)) {
        diagnostics.push(mismatch(nodeType, field, schema, value, nodeId));
      }
      continue;
    }

    if (typeof value === "boolean") {
      if (!acc.acceptsBoolean && !acc.literals.includes(value)) {
        diagnostics.push(mismatch(nodeType, field, schema, value, nodeId));
      }
      continue;
    }

    if (typeof value === "string") {
      if (acc.literals.includes(value)) continue;
      if (!acc.acceptsString) {
        diagnostics.push(mismatch(nodeType, field, schema, value, nodeId));
        continue;
      }
      for (const regex of acc.regexes) {
        if (!new RegExp(regex.pattern, regex.flags).test(value)) {
          diagnostics.push(
            errorDiagnostic(
              "constraint-violation",
              `"${field}" value ${JSON.stringify(value)} does not match the required format`,
              { nodeId, field },
            ),
          );
          break;
        }
      }
      continue;
    }

    if (typeof value === "object" && value !== null) {
      if (!acc.isStructured) {
        diagnostics.push(mismatch(nodeType, field, schema, value, nodeId));
      }
      continue;
    }

    diagnostics.push(mismatch(nodeType, field, schema, value, nodeId));
  }

  return diagnostics;
}

function mismatch(
  nodeType: NodeType,
  field: string,
  schema: NonNullable<ReturnType<typeof styleFieldSchema>>,
  value: unknown,
  nodeId?: string,
): StyleDiagnostic {
  const acc = acceptanceOf(schema);
  const expected =
    acc.literals.length > 0 && expectedTypeLabel(schema) === "enum"
      ? `one of ${acc.literals.map((literal) => JSON.stringify(literal)).join(", ")}`
      : expectedTypeLabel(schema);
  return errorDiagnostic(
    "invalid-value",
    `"${field}" on ${nodeType} expects ${expected}, got ${JSON.stringify(value)}`,
    { nodeId, field },
  );
}
