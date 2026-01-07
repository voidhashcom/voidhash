"use client";

import type {
	Variable,
	VariableType,
	VariableTypeKey,
} from "@voidhash/mimic-schema";
import {
	cn,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@voidhash/ui";
import { useMemo } from "react";
import { toast } from "sonner";
import { VARIABLE_TYPE_REGISTRY } from "../../constants";
import { LiteralInput } from "./literal-input";
import type { VariableInputValue } from "./types";
import { DiamondIcon } from "lucide-react";
import { PanelButton } from "../ui/button";

export interface VariableInputProps {
	value: VariableInputValue;
	onChange: (value: VariableInputValue) => void;
	/** Available variables that can be referenced */
	variables: readonly Variable[];
	/** If set, only allows this type (filters variables, constrains literals) */
	expectedType?: VariableTypeKey;
	className?: string;
}

export function VariableInput({
	value,
	onChange,
	variables,
	expectedType,
	className,
}: VariableInputProps) {
	const isLiteral = value.type === "literal";

	// Filter variables by expected type
	const compatibleVariables = useMemo(() => {
		if (!expectedType) {
			return variables;
		}
		return variables.filter((v) => v.value.key === expectedType);
	}, [variables, expectedType]);

	// Get current variable info for display
	const currentVariableId = useMemo(() => {
		if (value.type !== "variable-reference") {
			return null;
		}
		return (value.value as { id: string }).id;
	}, [value]);

	const currentVariableName = useMemo(() => {
		if (!currentVariableId) {
			return null;
		}
		const variable = variables.find((v) => v.id === currentVariableId);
		return variable?.name ?? "Unknown";
	}, [currentVariableId, variables]);

	// Get current type from value
	const currentType = useMemo((): VariableTypeKey => {
		if (value.type === "literal") {
			return (value.value as VariableType).key;
		}
		const variableRef = value.value as { id: string };
		const variable = variables.find((v) => v.id === variableRef.id);
		return variable?.value.key ?? "boolean";
	}, [value, variables]);

	const handleSourceChange = (source: "literal" | "variable") => {
		if (source === "literal") {
			onChange({
				type: "literal",
				value: VARIABLE_TYPE_REGISTRY[expectedType ?? currentType].defaultValue,
			});
		} else {
			// Find first compatible variable
			const firstVariable = compatibleVariables[0];
			if (firstVariable) {
				onChange({
					type: "variable-reference",
					value: { id: firstVariable.id },
				});
			} else {
				toast.error("No compatible variables available");
			}
		}
	};

	const handleVariableChange = (variableId: string) => {
		onChange({
			type: "variable-reference",
			value: { id: variableId },
		});
	};

	const handleLiteralChange = (literalValue: VariableType) => {
		onChange({
			type: "literal",
			value: literalValue,
		});
	};

	return (
		<div
			className={cn(
				"flex flex-row ring-1 ring-border rounded-md items-center",
				className,
			)}
		>
			{/* Value/Variable input */}
			{isLiteral ? (
				<LiteralInput
					className="flex-1"
					expectedType={expectedType}
					onChange={handleLiteralChange}
					value={value.value as VariableType}
				/>
			) : (
				<Select
					onValueChange={handleVariableChange}
					value={currentVariableId ?? ""}
				>
					<SelectTrigger className="h-7 min-w-24 text-xs flex-1" size="sm">
						<SelectValue placeholder="Select variable">
							{currentVariableName}
						</SelectValue>
					</SelectTrigger>
					<SelectContent>
						{compatibleVariables.map((variable) => (
							<SelectItem key={variable.id} value={variable.id}>
								{variable.name}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			)}

			{/* Toggle between literal and variable */}
			<PanelButton
				icon={
					<DiamondIcon
						className={cn(
							"text-muted-foreground",
							!isLiteral && "text-primary",
						)}
						fill={isLiteral ? "transparent" : "currentColor"}
					/>
				}
				onClick={() => {
					if (isLiteral) {
						handleSourceChange("variable");
						return;
					}
					handleSourceChange("literal");
				}}
				size="icon"
				variant="ghost"
			/>
		</div>
	);
}
