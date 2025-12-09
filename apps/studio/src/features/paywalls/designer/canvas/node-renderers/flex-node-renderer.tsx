import type { FlexNodeData } from "../../state/schema";
import { Selectable } from "../helpers/selectable";
import { FlexLayoutRenderer } from "./layouts/flex-layout-renderer";

export function FlexNodeRenderer({
	node,
	children,
	ref,
}: {
	node: FlexNodeData;
	children: React.ReactNode;
	ref?: React.RefObject<HTMLDivElement | null>;
}) {
	return (
		<Selectable nodeId={node.id}>
			{(selectableProps) => (
				<FlexLayoutRenderer style={node.style} {...selectableProps} ref={ref}>
					{children}
				</FlexLayoutRenderer>
			)}
		</Selectable>
	);
}
