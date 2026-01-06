import type { ScreenNodeData } from "@voidhash/mimic-schema";
import type { Properties } from "csstype";
import { px } from "./utils";

export function buildScreenContainerStyles(
	style: ScreenNodeData["style"],
): Properties {
	const styles: Properties = {
		width: "100vw",
		height: "100vh",
		boxSizing: "border-box",
		overflow: "hidden",
	};

	if (style.backgroundEnabled) {
		styles.backgroundColor = style.backgroundColor;
	} else {
		styles.backgroundColor = "transparent";
	}

	return styles;
}

export function buildScreenLayoutStyles(
	style: ScreenNodeData["style"],
): Properties {
	return {
		display: style.display,
		flexDirection: style.flexDirection,
		justifyContent: style.justifyContent,
		alignItems: style.alignItems,
		gap: px(style.gap ?? 0),
		paddingTop: px(style.paddingTop ?? 0),
		paddingRight: px(style.paddingRight ?? 0),
		paddingBottom: px(style.paddingBottom ?? 0),
		paddingLeft: px(style.paddingLeft ?? 0),
		width: "100vw",
		height: "100vh",
	};
}
