"use client";

import { Panel } from "@/features/designer/components/panel";
import { PANEL_DIMENSIONS } from "./constants";

import { LayersSection } from "./left-panel/layers-section";

export function LeftPanel() {
	return (
		<div
			className="fixed bottom-0 left-0 z-40 flex flex-col border-border border-r bg-sidebar"
			style={{
				top: PANEL_DIMENSIONS.TOP_HEIGHT,
				width: PANEL_DIMENSIONS.LEFT_WIDTH,
			}}
		>
			<Panel>
				{/* Content */}
				<div className="flex-1 overflow-y-auto p-2">
					<LayersSection />
				</div>
			</Panel>
		</div>
	);
}
