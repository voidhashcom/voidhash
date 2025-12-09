import type { TextNodeData } from "../../state/schema";
import { Selectable } from "../helpers/selectable";

export function TextNodeRenderer({ node }: { node: TextNodeData }) {
	return (
		<Selectable nodeId={node.id}>
			{(selectableProps) => (
				<div
					style={{
						fontSize: node.style.fontSize,
						color: node.style.color,
						fontWeight: node.style.fontWeight,
						textAlign: node.style.textAlign,
						lineHeight: node.style.lineHeight,
						letterSpacing: node.style.letterSpacing,
					}}
					{...selectableProps}
				>
					{node.text}
				</div>
			)}
		</Selectable>
	);
}
