import type { FlexDirection } from "@voidhash/dff";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@voidhash/ui";
import { Schema } from "effect";
import { ChevronDownIcon } from "lucide-react";
import { PanelButton } from "@/features/designer/components/button";
import type { NodeEditorProps, PropertiesOfGroup } from "../../types";
import { TextInput } from "./text-input";

type HeightInputProps = NodeEditorProps<
	PropertiesOfGroup<"dimensions" | "flexChild">
> & {
	disabled?: boolean;
	parentDirection: FlexDirection;
};

type HeightState = "fill" | "hug" | "custom";

function getHeightState(
	node: HeightInputProps["node"],
	parentDirection: FlexDirection,
): HeightState {
	if (parentDirection === "row" && node.alignSelf === "stretch") {
		return "fill";
	}

	if (parentDirection === "column" && node.flex === 1) {
		return "fill";
	}

	if (node.height === null) {
		return "hug";
	}

	return "custom";
}

export function HeightInput({
	node,
	onNodeChange,
	disabled = false,
	parentDirection,
}: HeightInputProps) {
	const state = getHeightState(node, parentDirection);

	const handleSelectCustom = () => {
		onNodeChange({
			...node,
			height: node.height ?? 100,
			...(parentDirection === "row" ? { alignSelf: "auto" } : { flex: null }),
		});
	};

	const handleSelectHug = () => {
		onNodeChange({
			...node,
			height: null,
			...(parentDirection === "row" ? { alignSelf: "auto" } : { flex: null }),
		});
	};

	const handleSelectFill = () => {
		onNodeChange({
			...node,
			height: null,
			...(parentDirection === "row" ? { alignSelf: "stretch" } : { flex: 1 }),
		});
	};

	return (
		<TextInput
			icon={<div className="font-bold text-xs">H</div>}
			label="Height"
			onChange={(value) => onNodeChange({ ...node, height: Number(value) })}
			type="number"
			typeNumberStepIncrement={1}
			validator={Schema.String}
			value={node.height?.toString() ?? "-"}
			disabled={disabled || state !== "custom"}
			trailing={
				!disabled && (
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<PanelButton className="bg-transparent dark:bg-transparent pr-3">
								{state === "custom" && <ChevronDownIcon className="size-3.5" />}
								{state === "hug" && (
									<div className="font-bold text-xs">Hug</div>
								)}
								{state === "fill" && (
									<div className="font-bold text-xs">Fill</div>
								)}
							</PanelButton>
						</DropdownMenuTrigger>
						<DropdownMenuContent>
							<DropdownMenuItem onSelect={handleSelectCustom}>
								Fixed height ({node.height ?? 100} px)
							</DropdownMenuItem>
							<DropdownMenuItem onSelect={handleSelectHug}>
								Hug content
							</DropdownMenuItem>
							<DropdownMenuItem onSelect={handleSelectFill}>
								Fill container
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				)
			}
		/>
	);
}
