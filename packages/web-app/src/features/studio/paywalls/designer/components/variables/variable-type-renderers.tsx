"use client";

import type { VariableType } from "@voidhash/mimic-schema";

import { BooleanInput } from "./inputs/boolean-input";
import { NumberInput } from "./inputs/number-input";
import { ProductInput } from "./inputs/product-input";
import { StringInput } from "./inputs/string-input";

/**
 * Renders the appropriate input for a given variable type.
 * Uses pattern matching to ensure type safety.
 */
export function renderVariableInput(
  value: VariableType,
  onChange: (value: VariableType) => void,
  className?: string,
): React.ReactNode {
  switch (value.key) {
    case "boolean":
      return (
        <BooleanInput
          className={className}
          onChange={(v) => onChange({ key: "boolean", value: v })}
          value={value.value}
        />
      );
    case "number":
      return (
        <NumberInput
          className={className}
          onChange={(v) => onChange({ key: "number", value: v })}
          value={value.value}
        />
      );
    case "string":
      return (
        <StringInput
          className={className}
          onChange={(v) => onChange({ key: "string", value: v })}
          value={value.value}
        />
      );
    case "product":
      return (
        <ProductInput
          className={className}
          onChange={(v) =>
            onChange({
              key: "product",
              value: v.productId === null ? {} : { productId: v.productId },
            })
          }
          value={{ productId: value.value.productId ?? null }}
        />
      );
  }
}
