"use client";

import { cn } from "@voidhash/ui";
import { PanelToggleGroup, PanelToggleGroupItem } from "../../ui/toggle-group";

export interface BooleanInputProps {
	value: boolean;
	onChange: (value: boolean) => void;
	className?: string;
}

export function BooleanInput({
	value,
	onChange,
	className,
}: BooleanInputProps) {
	return (
		<PanelToggleGroup
			className={cn("h-7 flex items-center", className)}
			onValueChange={(v) => onChange(v === "true")}
			type="single"
			value={value ? "true" : "false"}
		>
			<PanelToggleGroupItem className="h-7 px-2 text-xs flex-1" value="true">
				True
			</PanelToggleGroupItem>
			<PanelToggleGroupItem className="h-7 px-2 text-xs flex-1" value="false">
				False
			</PanelToggleGroupItem>
		</PanelToggleGroup>
	);
}
