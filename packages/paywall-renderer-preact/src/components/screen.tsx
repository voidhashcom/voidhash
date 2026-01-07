import type { ScreenNodeData } from "@voidhash/mimic-schema";
import {
	buildScreenContainerStyles,
	buildScreenLayoutStyles,
} from "@voidhash/paywall-renderer-web-core";
import type { ComponentChildren } from "preact";

type ScreenProps = {
	node: ScreenNodeData;
	children: ComponentChildren;
};

export function Screen({ node, children }: ScreenProps) {
	const containerStyles = buildScreenContainerStyles(node.style);
	const layoutStyles = buildScreenLayoutStyles(node.style);
	return (
		<div
			data-node-id={node.id}
			style={containerStyles as Record<string, string | number>}
		>
			<div style={layoutStyles as Record<string, string | number>}>
				{/* I hate all of this, but it's the only way to get the types to work, probably due to conflicts with Preact and React. */}
				{children as unknown as null}
			</div>
		</div>
	);
}
