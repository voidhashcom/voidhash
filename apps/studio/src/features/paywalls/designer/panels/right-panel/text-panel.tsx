"use client";

import type { FontWeight, TextAlign, TextNodeData } from "@voidhash/dff";
import { usePaywallDesignerActions } from "../../state/designer-store";
import { TypographySection } from "./sections/typography-section";

export function TextPanel({ node }: { node: TextNodeData }) {
	const dispatch = usePaywallDesignerActions();

	const handleFontSizeChange = (fontSize: number) => {
		dispatch("updateTextNode", {
			...node,
			style: { ...node.style, fontSize },
		});
	};

	const handleColorChange = (color: string) => {
		dispatch("updateTextNode", {
			...node,
			style: { ...node.style, color },
		});
	};

	const handleFontWeightChange = (fontWeight: FontWeight) => {
		dispatch("updateTextNode", {
			...node,
			style: { ...node.style, fontWeight },
		});
	};

	const handleTextAlignChange = (textAlign: TextAlign) => {
		dispatch("updateTextNode", {
			...node,
			style: { ...node.style, textAlign },
		});
	};

	const handleLineHeightChange = (lineHeight: number) => {
		dispatch("updateTextNode", {
			...node,
			style: { ...node.style, lineHeight },
		});
	};

	const handleLetterSpacingChange = (letterSpacing: number) => {
		dispatch("updateTextNode", {
			...node,
			style: { ...node.style, letterSpacing },
		});
	};

	return (
		<TypographySection
			color={node.style.color}
			fontSize={node.style.fontSize}
			fontWeight={node.style.fontWeight}
			letterSpacing={node.style.letterSpacing}
			lineHeight={node.style.lineHeight}
			onColorChange={handleColorChange}
			onFontSizeChange={handleFontSizeChange}
			onFontWeightChange={handleFontWeightChange}
			onLetterSpacingChange={handleLetterSpacingChange}
			onLineHeightChange={handleLineHeightChange}
			onTextAlignChange={handleTextAlignChange}
			textAlign={node.style.textAlign}
		/>
	);
}
