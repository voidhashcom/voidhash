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
import type { NodeEditorProps } from "../../types";
import { TextInput } from "./text-input";

type WidthInputProps = NodeEditorProps<
	| "width"
	| "height"
	| "flex"
	| "flexGrow"
	| "flexShrink"
	| "flexBasis"
	| "alignSelf"
> & {
	disabled?: boolean;
	parentDirection: FlexDirection;
};

type WidthState = "fill" | "hug" | "custom";

function getWidthState(
	node: WidthInputProps["node"],
	parentDirection: FlexDirection,
): WidthState {
	if (parentDirection === "column" && node.alignSelf === "stretch") {
		return "fill";
	}

	if (parentDirection === "row" && node.flex === 1) {
		return "fill";
	}

	if (node.width === null) {
		return "hug";
	}

	return "custom";
}

export function WidthInput({
	node,
	onNodeChange,
	disabled = false,
	parentDirection,
}: WidthInputProps) {
	const state = getWidthState(node, parentDirection);

	const handleSelectCustom = () => {
		onNodeChange({
			...node,
			width: node.width ?? 100,
			...(parentDirection === "column"
				? { alignSelf: "auto" }
				: { flex: null }),
		});
	};

	const handleSelectHug = () => {
		onNodeChange({
			...node,
			width: null,
			...(parentDirection === "column"
				? { alignSelf: "auto" }
				: { flex: null }),
		});
	};

	const handleSelectFill = () => {
		onNodeChange({
			...node,
			width: null,
			...(parentDirection === "column"
				? { alignSelf: "stretch" }
				: { flex: 1 }),
		});
	};

	return (
		<TextInput
			icon={<div className="font-bold text-xs">W</div>}
			label="Width"
			onChange={(value) => onNodeChange({ ...node, width: Number(value) })}
			type="number"
			typeNumberStepIncrement={1}
			validator={Schema.String}
			value={node.width?.toString() ?? "-"}
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
								Fixed width ({node.width ?? 100} px)
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
