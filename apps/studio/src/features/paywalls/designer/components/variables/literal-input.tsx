"use client";

import type { VariableType, VariableTypeKey } from "@voidhash/mimic-schema";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@voidhash/ui";
import { VARIABLE_TYPE_REGISTRY } from "../../constants";
import { BooleanInput } from "./inputs/boolean-input";
import { NumberInput } from "./inputs/number-input";
import { ProductInput } from "./inputs/product-input";
import { StringInput } from "./inputs/string-input";

export interface LiteralInputProps {
	value: VariableType;
	onChange: (value: VariableType) => void;
	/** If set, constrains to this type and hides type selector */
	expectedType?: VariableTypeKey;
	className?: string;
}

/**
 * Exhaustive check helper - will cause a compile error if a case is not handled.
 */
function assertNever(value: never): never {
	throw new Error(`Unhandled variable type: ${JSON.stringify(value)}`);
}

/**
 * Renders the appropriate input component based on the variable type.
 */
function renderTypeInput(
	value: VariableType,
	onChange: (value: VariableType) => void,
): React.ReactNode {
	switch (value.key) {
		case "boolean": {
			return (
				<BooleanInput
					className="flex-1 w-auto"
					onChange={(v) => onChange({ key: "boolean", value: v })}
					value={value.value}
				/>
			);
		}
		case "string": {
			return (
				<StringInput
					className="flex-1"
					onChange={(v) => onChange({ key: "string", value: v })}
					value={value.value}
				/>
			);
		}
		case "number": {
			return (
				<NumberInput
					className="flex-1 w-auto"
					onChange={(v) => onChange({ key: "number", value: v })}
					value={value.value}
				/>
			);
		}
		case "product": {
			return (
				<ProductInput
					className="flex-1"
					onChange={(v) => onChange({ key: "product", value: v })}
					value={value.value}
				/>
			);
		}
		default: {
			// This will cause a compile error if a new variable type is added
			// but not handled in the switch statement
			return assertNever(value);
		}
	}
}

export function LiteralInput({
	value,
	onChange,
	className,
}: LiteralInputProps) {
	return (
		<div className={className ?? "flex flex-row gap-1"}>
			{/* Type-specific input */}
			{renderTypeInput(value, onChange)}
		</div>
	);
}
