"use client";

import type { TextNodeData } from "@voidhash/mimic-schema";
import { updateTextNode } from "../../state/actions";
import { usePaywallDesignerActions } from "../../state/designer-store";
import { StatesSection } from "./sections/states-section";
import { TextFillSection } from "./sections/text-fill-section";
import { TypographySection } from "./sections/typography-section";
import { VariablesSection } from "./sections/variables-section";

export function TextPanel({ node }: { node: TextNodeData }) {
	const dispatch = usePaywallDesignerActions();

	const handleNodeChange = (updatedNode: typeof node.data.style) => {
		dispatch(updateTextNode)({
			...node,
			style: { ...node.data.style, ...updatedNode },
		});
	};

	return (
		<>
			<VariablesSection
				node={node}
				onAddVariable={(nodeId, type, name) =>
					dispatch("addTextNodeVariable", { nodeId, type, name })
				}
				onRemoveVariable={(nodeId, variableId) =>
					dispatch("removeTextNodeVariable", { nodeId, variableId })
				}
				onUpdateVariable={(nodeId, variableId, updates) =>
					dispatch("updateTextNodeVariable", {
						nodeId,
						variableId,
						...updates,
					})
				}
			/>
			<StatesSection
				node={node}
				onAddState={(nodeId, name, condition) =>
					dispatch("addTextNodeState", { nodeId, name, condition })
				}
				onRemoveState={(nodeId, stateId) =>
					dispatch("removeTextNodeState", { nodeId, stateId })
				}
				onUpdateState={(nodeId, stateId, updates) =>
					dispatch("updateTextNodeState", {
						nodeId,
						stateId,
						...updates,
					})
				}
			/>
			<TypographySection
				node={node.data.style}
				onNodeChange={handleNodeChange}
			/>
			<TextFillSection node={node.data.style} onNodeChange={handleNodeChange} />
		</>
	);
}
