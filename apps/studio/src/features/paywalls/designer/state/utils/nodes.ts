import type { Primitive } from "@voidhash/mimic";
import type { PaywallDesignerStoreType } from "../designer-store";
import type {
	DesignerStateNodes,
	NodeData,
	NodeDataWithoutRoot,
} from "../schema";

type TreeNode<T extends NodeData> = T & {
	children: TreeNode<T>[];
};

export function getNodesByParentId<TStateNodes extends DesignerStateNodes>(
	nodes: TStateNodes,
	parentId: string,
): NodeDataWithoutRoot[] {
	return Object.values(nodes ?? {}).filter(
		(n) =>
			n.type !== "root" && (n as NodeDataWithoutRoot).parentId === parentId,
	) as NodeDataWithoutRoot[];
}

type StoreData = PaywallDesignerStoreType;

const getNodeByIdInSnapshot = (
	snapshot: Primitive.TreeNodeSnapshot<Primitive.AnyTreeNodePrimitive>,
	id: string,
) => {
	if (snapshot.id === id) {
		return snapshot;
	}
	if (snapshot.children) {
		for (const child of snapshot.children) {
			const found = getNodeByIdInSnapshot(child, id);
			if (found) {
				return found;
			}
		}
	}
	return null;
};

export const getNodeById = (
	state: ReturnType<StoreData["getState"]>,
	id: string,
) => {
	const treeSnapshot = state.mimic.snapshot;
	if (!treeSnapshot) {
		return null;
	}
	return getNodeByIdInSnapshot(treeSnapshot, id);
};
