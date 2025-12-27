import { useLayoutEffect, useRef } from "react";
import { useStore } from "zustand/react";
import { updateBoundingBox } from "../state/actions";
import {
	usePaywallDesignerActions,
	usePaywallDesignerStore,
} from "../state/designer-store";
import type { FlexNodeData, ScreenNodeData, TextNodeData } from "../state/schema";
import { FlexNodeRenderer } from "./node-renderers/flex-node-renderer";
import { ScreenNodeRenderer } from "./node-renderers/screen-node-renderer";
import { TextNodeRenderer } from "./node-renderers/text-node-renderer";
import { useViewport } from "./viewport";

/** Snapshot node structure from mimic - the tree is already structured */
interface SnapshotNode {
	id: string;
	type: string;
	name?: string;
	text?: string;
	style?: Record<string, unknown>;
	data?: Record<string, unknown>;
	children?: SnapshotNode[];
}

export function NodeRenderer({
	node,
}: {
	node: SnapshotNode;
}) {
	const dispatch = usePaywallDesignerActions();
	const children = node.children ?? [];
	const elementRef = useRef<HTMLDivElement>(null);
	const viewport = useViewport();

	// Measure node bounding box on render
	useLayoutEffect(() => {
		// Skip measurement for root nodes
		if (node.type === "root") {
			return;
		}

		const element = elementRef.current;
		if (!element) {
			return;
		}

		const measureBoundingBox = () => {
			const rect = element.getBoundingClientRect();

			// Convert screen coordinates to canvas coordinates
			// screenToCanvas expects viewport/screen coordinates
			const canvasCoords = viewport.screenToCanvas(rect.left, rect.top);

			// Get dimensions in canvas space (accounting for scale)
			const transform = viewport.getTransform();
			const canvasWidth = rect.width / transform.scale;
			const canvasHeight = rect.height / transform.scale;

			dispatch(updateBoundingBox)({
				id: node.id,
				boundingBox: {
					x: canvasCoords.x,
					y: canvasCoords.y,
					width: canvasWidth,
					height: canvasHeight,
				},
			});
		};

		// Measure immediately
		measureBoundingBox();

		// Also measure on resize
		const resizeObserver = new ResizeObserver(measureBoundingBox);
		resizeObserver.observe(element);

		return () => {
			resizeObserver.disconnect();
		};
	}, [node.id, node.type, viewport, dispatch]);

	if (node.type === "root") {
		return (
			<>
				{children.map((child) => (
					<NodeRenderer key={child.id} node={child} />
				))}
			</>
		);
	}
	if (node.type === "screen") {
		return (
			<ScreenNodeRenderer node={node as unknown as ScreenNodeData} ref={elementRef}>
				{children.map((child) => (
					<NodeRenderer key={child.id} node={child} />
				))}
			</ScreenNodeRenderer>
		);
	}
	if (node.type === "text") {
		return (
			<div ref={elementRef}>
				<TextNodeRenderer node={node as unknown as TextNodeData} />
			</div>
		);
	}

	if (node.type === "flex") {
		return (
			<FlexNodeRenderer node={node as unknown as FlexNodeData} ref={elementRef}>
				{children.map((child) => (
					<NodeRenderer key={child.id} node={child} />
				))}
			</FlexNodeRenderer>
		);
	}

	return null;
}

export function NodeTreeRenderer() {
	const store = usePaywallDesignerStore();
	const snapshot = useStore(
		store,
		(state) => state.mimic.snapshot,
	);

	if (!snapshot) {
		return null;
	}

	return (
		<div className="relative">
			<NodeRenderer node={snapshot as SnapshotNode} />
		</div>
	);
}
