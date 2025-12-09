"use client";

import { Schema } from "effect";
import { TypeIcon } from "lucide-react";
import {
	PanelSection,
	PanelSectionContent,
	PanelSectionHeader,
	PanelSectionTitle,
} from "@/features/designer/components/panel-section";
import { TextInput } from "../inputs/text-input";

export interface TextSectionProps {
	/** The text value to display */
	value: string;
	/** Callback when the text value changes */
	onChange: (value: string) => void;
}

export function TextSection({ value, onChange }: TextSectionProps) {
	return (
		<PanelSection>
			<PanelSectionHeader>
				<PanelSectionTitle>Text</PanelSectionTitle>
			</PanelSectionHeader>
			<PanelSectionContent>
				<TextInput
					label="Text"
					onChange={onChange}
					type="text"
					validator={Schema.String}
					value={value}
				/>
			</PanelSectionContent>
		</PanelSection>
	);
}
