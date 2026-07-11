import type { EditableNodeType, SectionRegistryEntry } from "../types";

const SECTION_REGISTRY: SectionRegistryEntry[] = [
  {
    id: "variables",
    supportedNodeTypes: ["screen", "view", "scrollView", "text", "shape", "path"],
    order: 0,
    multiSelectable: false,
  },
  {
    id: "states",
    supportedNodeTypes: ["screen", "view", "scrollView", "text", "shape", "path"],
    order: 1,
    multiSelectable: false,
  },
  {
    id: "scrollViewSettings",
    supportedNodeTypes: ["scrollView"],
    order: 2,
    multiSelectable: true,
  },
  {
    id: "position",
    supportedNodeTypes: ["view", "scrollView", "text"],
    order: 2,
    multiSelectable: true,
  },
  {
    id: "flexLayout",
    supportedNodeTypes: ["screen", "view", "scrollView"],
    order: 3,
    multiSelectable: true,
  },
  {
    id: "shapeLayout",
    supportedNodeTypes: ["shape"],
    order: 3,
    multiSelectable: false,
  },
  {
    id: "borderRadius",
    supportedNodeTypes: ["view", "scrollView"],
    order: 4,
    multiSelectable: true,
  },
  {
    id: "fill",
    supportedNodeTypes: ["screen", "view", "scrollView"],
    order: 5,
    multiSelectable: true,
  },
  {
    id: "border",
    supportedNodeTypes: ["view", "scrollView"],
    order: 6,
    multiSelectable: true,
  },
  {
    id: "interactions",
    supportedNodeTypes: ["view", "scrollView"],
    order: 7,
    multiSelectable: true,
  },
  {
    id: "content",
    supportedNodeTypes: ["text"],
    order: 8,
    multiSelectable: false,
  },
  {
    id: "typography",
    supportedNodeTypes: ["text"],
    order: 8,
    multiSelectable: true,
  },
  {
    id: "textFill",
    supportedNodeTypes: ["text"],
    order: 9,
    multiSelectable: true,
  },
  {
    id: "pathFill",
    supportedNodeTypes: ["path"],
    order: 10,
    multiSelectable: true,
  },
  {
    id: "pathStroke",
    supportedNodeTypes: ["path"],
    order: 11,
    multiSelectable: true,
  },
  {
    id: "componentSettings",
    supportedNodeTypes: ["component"],
    order: 12,
    multiSelectable: false,
  },
  {
    id: "componentProps",
    supportedNodeTypes: ["component"],
    order: 13,
    multiSelectable: false,
  },
  {
    id: "componentActions",
    supportedNodeTypes: ["component"],
    order: 14,
    multiSelectable: false,
  },
];

/**
 * Returns sections applicable to the given set of node types.
 * A section is included only if ALL node types are in its supportedNodeTypes.
 * When isMulti is true, sections with multiSelectable=false are excluded.
 */
export function getSharedSections(
  nodeTypes: EditableNodeType[],
  isMulti: boolean,
): SectionRegistryEntry[] {
  return SECTION_REGISTRY.filter((entry) => {
    if (isMulti && !entry.multiSelectable) return false;
    return nodeTypes.every((t) => entry.supportedNodeTypes.includes(t));
  }).sort((a, b) => a.order - b.order);
}
