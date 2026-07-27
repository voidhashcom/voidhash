"use client";

import type { ComponentPropDefinition } from "@voidhash/core/services/paywallDeploys/PaywallDeployManifest";
import type { VariableType, VariableTypeKey } from "@voidhash/mimic-schema";
import { Badge, Button } from "@voidhash/ui";
import { MinusIcon, PlusIcon, RotateCcwIcon } from "lucide-react";
import { useMemo } from "react";

import { BooleanInput } from "@/features/studio/paywalls/designer/components/variables/inputs/boolean-input";
import { NumberInput } from "@/features/studio/paywalls/designer/components/variables/inputs/number-input";
import { StringInput } from "@/features/studio/paywalls/designer/components/variables/inputs/string-input";
import { isLiteralValue } from "@/features/studio/paywalls/designer/components/variables/types";
import type {
  LabeledVariable,
  VariableInputValue,
} from "@/features/studio/paywalls/designer/components/variables/types";
import { VARIABLE_TYPE_REGISTRY } from "@/features/studio/paywalls/designer/constants";
import {
  manifestDefaultPropValue,
  readBooleanArray,
  readNumberArray,
  readStringArray,
  scalarVariableTypeKeyForProp,
  type ComponentPropBindingPlain,
  type ComponentPropValuePlain,
} from "@/features/studio/paywalls/designer/state/utils/component-prop-values";

import { hexColorToRgbaString, rgbaStringToHexColor } from "../panels/right-panel/utils/component-color";
import { ColorInput } from "./color-input";
import { SelectInput } from "./select-input";
import { VariableInput } from "@/features/studio/paywalls/designer/components/variables/variable-input";

type ScalarArrayKey = "string-array" | "number-array" | "boolean-array";

/** Structural deep equality used to detect a uniform value across multiple targets. */
function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (typeof a !== typeof b) return false;
  if (typeof a !== "object") return false;
  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return false;
    return a.every((value, index) => deepEqual(value, b[index]));
  }
  const objectA = a as Record<string, unknown>;
  const objectB = b as Record<string, unknown>;
  const keysA = Object.keys(objectA);
  const keysB = Object.keys(objectB);
  if (keysA.length !== keysB.length) return false;
  return keysA.every((key) => deepEqual(objectA[key], objectB[key]));
}

function scalarArrayKeyForProp(def: ComponentPropDefinition): ScalarArrayKey | undefined {
  if (def.kind !== "array") {
    return undefined;
  }
  switch (def.item.kind) {
    case "string":
    case "select":
    case "image":
      return "string-array";
    case "number":
      return "number-array";
    case "boolean":
      return "boolean-array";
    default:
      return undefined;
  }
}

function isCodeConfiguredKind(def: ComponentPropDefinition): boolean {
  if (def.kind === "component") {
    return true;
  }
  return def.kind === "array" && (def.item.kind === "component" || def.item.kind === "ref");
}

function scalarPropValueToVariableType(value: ComponentPropValuePlain): VariableType | undefined {
  switch (value.key) {
    case "string":
    case "number":
    case "boolean":
      return value;
    case "product":
      return {
        key: "product",
        value: value.value.productId == null ? {} : { productId: value.value.productId },
      };
    default:
      return undefined;
  }
}

/**
 * A per-target binding for one prop: the target node id and its stored binding
 * for the prop (`undefined` when the target has no stored value → manifest
 * default).
 */
export interface PropTargetBinding {
  id: string;
  storedBinding: ComponentPropBindingPlain | undefined;
}

/** Injectable write path so a later phase can swap single-node dispatch for a batched multi-node action. */
export interface PropWriteCallbacks {
  onSetProp: (propName: string, binding: ComponentPropBindingPlain) => void;
  onResetProp: (propName: string) => void;
}

/**
 * Per-locale editing context for a localizable string/image prop. When present,
 * the row edits the active locale's override rather than the base literal: it
 * shows a locale `badge`, and its reset (revert-to-base) affordance appears when
 * `hasOverride` is true — independent of whether a base value is stored. The
 * section supplies the resolved localized value through `targets` and routes
 * `onSetProp`/`onResetProp` to the per-locale write/clear path.
 */
export interface PropLocaleEditing {
  badge: string;
  hasOverride: boolean;
}

export interface PropFieldRowProps extends PropWriteCallbacks {
  propName: string;
  def: ComponentPropDefinition;
  /** One entry per selected component node (node id + stored binding for this prop). */
  targets: readonly PropTargetBinding[];
  variables: readonly LabeledVariable[];
  /** Present only when the row edits a per-locale override (string/image props). */
  localeEditing?: PropLocaleEditing;
}

function PropRowShell({
  label,
  badge,
  children,
  onReset,
}: {
  label: string;
  badge?: string;
  children: React.ReactNode;
  onReset?: () => void;
}) {
  return (
    <div className="flex flex-row items-center gap-2">
      <span className="flex min-w-16 max-w-24 items-center gap-1 truncate text-muted-foreground text-xs">
        <span className="truncate" title={label}>
          {label}
        </span>
        {badge && (
          <Badge className="px-1 py-0 text-[10px]" variant="secondary">
            {badge}
          </Badge>
        )}
      </span>
      <div className="flex min-w-0 flex-1 flex-row items-center gap-1">
        {children}
        {onReset && (
          <Button onClick={onReset} size="icon-sm" title="Reset to default" variant="ghost">
            <RotateCcwIcon />
          </Button>
        )}
      </div>
    </div>
  );
}

function ReadOnlyPropRow({ label, message }: { label: string; message: string }) {
  return (
    <PropRowShell label={label}>
      <span className="flex h-7 flex-1 items-center rounded-sm px-2 text-muted-foreground text-xs dark:bg-input/30">
        {message}
      </span>
    </PropRowShell>
  );
}

/** True when every target shares an identical (deep-equal) stored binding for the prop. */
function bindingsUniform(targets: readonly PropTargetBinding[]): boolean {
  if (targets.length <= 1) return true;
  const [first, ...rest] = targets;
  return rest.every((target) => deepEqual(target.storedBinding, first?.storedBinding));
}

function ScalarPropRow({
  propName,
  def,
  targets,
  variables,
  expectedType,
  localeEditing,
  onSetProp,
  onResetProp,
}: PropFieldRowProps & { expectedType: VariableTypeKey }) {
  const label = def.label ?? propName;
  const uniform = bindingsUniform(targets);
  const representative = targets[0]?.storedBinding;
  const isStored = targets.length > 0 && targets.every((t) => t.storedBinding !== undefined);
  // In per-locale mode the reset (revert-to-base) shows when an override exists,
  // not merely when a base value is stored.
  const showReset = localeEditing ? localeEditing.hasOverride : isStored;

  const inputValue = useMemo((): VariableInputValue => {
    const storedBinding = uniform ? representative : undefined;
    if (storedBinding?.type === "variable-reference") {
      return { type: "variable-reference", value: { id: storedBinding.value.id } };
    }
    if (storedBinding?.type === "literal") {
      const literal = scalarPropValueToVariableType(storedBinding.value);
      if (literal !== undefined && literal.key === expectedType) {
        return { type: "literal", value: literal };
      }
    }
    const fallback = manifestDefaultPropValue(def);
    const fallbackLiteral =
      fallback === undefined ? undefined : scalarPropValueToVariableType(fallback);
    if (fallbackLiteral !== undefined && fallbackLiteral.key === expectedType) {
      return { type: "literal", value: fallbackLiteral };
    }
    return { type: "literal", value: VARIABLE_TYPE_REGISTRY[expectedType].defaultValue };
  }, [uniform, representative, def, expectedType]);

  const handleChange = (next: VariableInputValue) => {
    const binding: ComponentPropBindingPlain = isLiteralValue(next)
      ? { type: "literal", value: next.value }
      : { type: "variable-reference", value: { id: (next.value as { id: string }).id } };
    onSetProp(propName, binding);
  };

  const renderLiteral = useMemo(() => {
    if (def.kind === "string" && def.editor === "color") {
      return (value: VariableType, onChange: (value: VariableType) => void) => (
        <ColorInput
          className="flex-1"
          onChange={(rgba) => onChange({ key: "string", value: rgbaStringToHexColor(rgba) })}
          value={hexColorToRgbaString(value.key === "string" ? value.value : "")}
        />
      );
    }
    if (def.kind === "select") {
      const options = def.options.map((option) => ({ label: option, value: option }));
      return (value: VariableType, onChange: (value: VariableType) => void) => (
        <SelectInput
          className="flex-1"
          label={label}
          onChange={(option) => onChange({ key: "string", value: option })}
          options={options}
          placeholder="Select…"
          value={value.key === "string" ? value.value : ""}
        />
      );
    }
    return undefined;
  }, [def, label]);

  return (
    <PropRowShell
      badge={localeEditing?.badge}
      label={label}
      onReset={showReset ? () => onResetProp(propName) : undefined}
    >
      <VariableInput
        className="min-w-0 flex-1"
        expectedType={expectedType}
        onChange={handleChange}
        renderLiteral={renderLiteral}
        value={inputValue}
        variables={variables}
      />
    </PropRowShell>
  );
}

function ArrayPropRow({
  propName,
  def,
  targets,
  arrayKey,
  onSetProp,
  onResetProp,
}: Omit<PropFieldRowProps, "variables"> & { arrayKey: ScalarArrayKey }) {
  const label = def.label ?? propName;
  const uniform = bindingsUniform(targets);
  const representative = targets[0]?.storedBinding;
  const isStored = targets.length > 0 && targets.every((t) => t.storedBinding !== undefined);

  const items = useMemo((): readonly (string | number | boolean)[] => {
    const storedBinding = uniform ? representative : undefined;
    let source: unknown;
    if (storedBinding?.type === "literal" && storedBinding.value.key === arrayKey) {
      source = storedBinding.value.value;
    } else {
      const fallback = manifestDefaultPropValue(def);
      source = fallback?.key === arrayKey ? fallback.value : undefined;
    }
    switch (arrayKey) {
      case "string-array":
        return readStringArray(source);
      case "number-array":
        return readNumberArray(source);
      case "boolean-array":
        return readBooleanArray(source);
    }
  }, [uniform, representative, def, arrayKey]);

  const rewrite = (next: readonly (string | number | boolean)[]) => {
    let value: ComponentPropValuePlain;
    switch (arrayKey) {
      case "string-array":
        value = {
          key: "string-array",
          value: next.filter((item): item is string => typeof item === "string"),
        };
        break;
      case "number-array":
        value = {
          key: "number-array",
          value: next.filter((item): item is number => typeof item === "number"),
        };
        break;
      case "boolean-array":
        value = {
          key: "boolean-array",
          value: next.filter((item): item is boolean => typeof item === "boolean"),
        };
        break;
    }
    onSetProp(propName, { type: "literal", value });
  };

  const handleAdd = () => {
    const defaultItem = arrayKey === "string-array" ? "" : arrayKey === "number-array" ? 0 : false;
    rewrite([...items, defaultItem]);
  };

  const handleRemove = (index: number) => {
    rewrite(items.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, item: string | number | boolean) => {
    rewrite(items.map((existing, i) => (i === index ? item : existing)));
  };

  return (
    <div className="flex flex-col gap-1">
      <div className="flex h-7 flex-row items-center justify-between">
        <span className="min-w-16 truncate text-muted-foreground text-xs" title={label}>
          {label}
        </span>
        <div className="flex flex-row items-center gap-1">
          {isStored && (
            <Button
              onClick={() => onResetProp(propName)}
              size="icon-sm"
              title="Reset to default"
              variant="ghost"
            >
              <RotateCcwIcon />
            </Button>
          )}
          <Button onClick={handleAdd} size="icon-sm" variant="outline">
            <PlusIcon />
          </Button>
        </div>
      </div>
      {items.length > 0 && (
        <div className="flex flex-col gap-1">
          {items.map((item, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: rows are positional; the whole binding is rewritten per change
            <div className="flex flex-row items-center gap-1" key={index}>
              {arrayKey === "string-array" && (
                <StringInput
                  className="flex-1"
                  onChange={(next) => handleItemChange(index, next)}
                  value={typeof item === "string" ? item : ""}
                />
              )}
              {arrayKey === "number-array" && (
                <NumberInput
                  className="flex-1"
                  onChange={(next) => handleItemChange(index, next)}
                  value={typeof item === "number" ? item : 0}
                />
              )}
              {arrayKey === "boolean-array" && (
                <BooleanInput
                  className="flex-1"
                  onChange={(next) => handleItemChange(index, next)}
                  value={item === true}
                />
              )}
              <Button onClick={() => handleRemove(index)} size="icon-sm" variant="ghost">
                <MinusIcon />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * One editable row for a single component prop, extracted from the Props
 * section. Parameterized by `targets` (node ids + their stored bindings, with
 * deep-equal detection of a uniform value across targets) and by injectable
 * write callbacks (`onSetProp`/`onResetProp`) so the write path can be a
 * single-node dispatch today or a batched multi-node action later.
 *
 * Preserves the per-kind mapping verbatim: code-configured kinds render a
 * read-only "Configured in code" row; scalar kinds render a {@link VariableInput}
 * with `color`/`select` literal overrides; scalar arrays render add/remove rows
 * with whole-array rewrite; everything else renders "Unsupported property type".
 * The reset affordance appears only when every target has a stored value.
 */
export function PropFieldRow(props: PropFieldRowProps) {
  const { propName, def } = props;
  const label = def.label ?? propName;

  if (isCodeConfiguredKind(def)) {
    return <ReadOnlyPropRow label={label} message="Configured in code" />;
  }

  const expectedType = scalarVariableTypeKeyForProp(def);
  if (expectedType !== undefined) {
    return <ScalarPropRow {...props} expectedType={expectedType} />;
  }

  const arrayKey = scalarArrayKeyForProp(def);
  if (arrayKey !== undefined) {
    return <ArrayPropRow {...props} arrayKey={arrayKey} />;
  }

  return <ReadOnlyPropRow label={label} message="Unsupported property type" />;
}
