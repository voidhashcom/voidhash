import type {
  ActionCallbacks,
  ComponentSnapshotNode,
  PreviewNode,
  PreviewNodeStyle,
  PreviewResolvedMotionStyle,
  PreviewTree,
  StyledPreviewNodeType,
  VariableValue,
} from "@voidhash/paywall-renderer-web-core";
import {
  buildPreviewNodeStyles,
  executeComponentBoundAction,
  previewResizeModeToObjectFit,
} from "@voidhash/paywall-renderer-web-core";
import type { ComponentChildren } from "preact";
import { useCallback, useMemo } from "preact/hooks";

import { usePaywallContext } from "../context/paywall-context";
import { BUILTIN_RENDERERS } from "./builtins/renderers";
import { resolveComponentInstanceProps } from "./builtins/resolve-props";

interface ComponentInstanceProps {
  node: ComponentSnapshotNode;
  children: ComponentChildren;
}

const PLACEHOLDER_STYLES: Record<string, string | number> = {
  alignItems: "center",
  backgroundColor: "#f4f4f5",
  border: "1px dashed #d4d4d8",
  borderRadius: "6px",
  boxSizing: "border-box",
  color: "#71717a",
  display: "flex",
  fontFamily: "inherit",
  fontSize: "11px",
  justifyContent: "center",
  minHeight: "40px",
  padding: "8px",
  position: "relative",
  textAlign: "center",
};

// This package's sources are compiled both under its own preact JSX config and
// under consumers' react-jsx configs (apps/www imports the .ts sources), so the
// style value must satisfy preact's index-signature `CSSProperties` AND React's
// csstype-based one. A homomorphic mapped copy of the csstype `Properties`
// interface does both: anonymous object types get an implicit index signature
// (interfaces do not) while keeping the structural csstype props.
type PreviewNodeCss = {
  [K in keyof ReturnType<typeof buildPreviewNodeStyles>]: ReturnType<
    typeof buildPreviewNodeStyles
  >[K];
};

function previewNodeStyle(
  style: PreviewNodeStyle,
  nodeType: StyledPreviewNodeType,
  motion?: PreviewResolvedMotionStyle,
): PreviewNodeCss {
  return { ...buildPreviewNodeStyles(style, nodeType, motion) };
}

function pickPreviewTree(
  trees: Record<string, PreviewTree> | undefined,
  previewState: string,
): PreviewTree | undefined {
  if (!trees) {
    return undefined;
  }
  for (const candidate of [previewState, "default"]) {
    const tree = trees[candidate];
    if (tree) {
      return tree;
    }
  }
  const firstState = Object.keys(trees)[0];
  return firstState === undefined ? undefined : trees[firstState];
}

function PreviewNodeView({
  node,
  slot,
  fireAction,
}: {
  node: PreviewNode;
  slot: ComponentChildren;
  fireAction: (actionName: string) => void;
}) {
  switch (node.type) {
    case "view":
    case "scroll": {
      return (
        <div style={previewNodeStyle(node.style, node.type, node.motion)}>
          {node.children.map((child, index) => (
            // preview trees are immutable per contentHash+state
            <PreviewNodeView fireAction={fireAction} key={index} node={child} slot={slot} />
          ))}
        </div>
      );
    }
    case "pressable": {
      const actionName = node.action;
      const onClick = actionName === undefined ? undefined : () => fireAction(actionName);
      return (
        <div onClick={onClick} style={previewNodeStyle(node.style, "pressable", node.motion)}>
          {node.children.map((child, index) => (
            // preview trees are immutable per contentHash+state
            <PreviewNodeView fireAction={fireAction} key={index} node={child} slot={slot} />
          ))}
        </div>
      );
    }
    case "text": {
      return <div style={previewNodeStyle(node.style, "text", node.motion)}>{node.text}</div>;
    }
    case "image": {
      return (
        <img
          alt=""
          src={node.src}
          style={{
            ...previewNodeStyle(node.style, "image", node.motion),
            objectFit: previewResizeModeToObjectFit(node.resizeMode) ?? "cover",
          }}
        />
      );
    }
    case "slot": {
      return <>{slot}</>;
    }
    case "placeholder": {
      return <div style={PLACEHOLDER_STYLES}>{node.reason}</div>;
    }
    default: {
      return null;
    }
  }
}

/**
 * Renders a `component` document node from its pinned preview-tree artifact
 * (contract §3, fixture-rendered output of a code component). Deployed
 * (`catalog`) nodes resolve their trees from `componentArtifacts.trees` by
 * `contentHash`; local (in-document) code components carry a sentinel
 * `contentHash: ""` and resolve from `componentArtifacts.localTrees` by
 * `componentPath` instead. The tree is picked by `previewState` →
 * `"default"` → first available state; with no matching tree a labeled
 * placeholder renders instead. The tree's `slot` marker mounts the node's
 * document children, and pressables carrying an `action` name dispatch the
 * node's matching `actionBindings` entry through `executeComponentBoundAction`
 * (no emitted payload exists in this static preview — `action-payload` sources
 * no-op). Builtin (`componentSource: "builtin"`) nodes bypass preview trees
 * entirely and render the real preact implementation from `BUILTIN_RENDERERS`
 * by slug, with document props resolved live.
 */
export function ComponentInstance({ node, children }: ComponentInstanceProps) {
  const { getNodeVariables, setNodeVariable, callbacks, componentArtifacts } = usePaywallContext();
  const variables = getNodeVariables(node.id);

  // Wrap onSetVariable to capture this node's ID (same idiom as useInteractions)
  const scopedCallbacks = useMemo<ActionCallbacks>(
    () => ({
      ...callbacks,
      onSetVariable: (variableId: string, newValue: VariableValue) => {
        setNodeVariable(node.id, variableId, newValue);
      },
    }),
    [callbacks, node.id, setNodeVariable],
  );

  // Preview-tree pressables fire with no payload; builtin implementations may
  // emit one, feeding the bound action's `action-payload` sources.
  const fireAction = useCallback(
    (actionName: string, payload?: Record<string, unknown>) => {
      const binding = node.data.actionBindings.find((entry) => entry.value?.name === actionName);
      const action = binding?.value?.action;
      if (!action) {
        return;
      }
      executeComponentBoundAction(action, payload, variables, scopedCallbacks);
    },
    [node.data.actionBindings, variables, scopedCallbacks],
  );

  // Builtins ship WITH this renderer: they resolve by stable slug (unpinned —
  // no contentHash) to a REAL preact component, not a pre-rendered preview
  // tree. Document props resolve live against the node's variable chain, and
  // named actions dispatch through the same `fireAction` as preview-tree
  // pressables. An unknown slug degrades to the shared placeholder.
  if (node.data.componentSource === "builtin") {
    const Builtin = BUILTIN_RENDERERS[node.data.componentSlug];
    if (!Builtin) {
      return (
        <div data-node-id={node.id} style={PLACEHOLDER_STYLES}>
          {`Component "${node.data.componentSlug}" preview unavailable`}
        </div>
      );
    }
    const builtinProps = resolveComponentInstanceProps(node.data.props, variables);
    return (
      <div data-node-id={node.id} style={{ display: "contents" }}>
        {/* @ts-ignore BuiltinRenderer returns preact ComponentChildren — not a valid element type when cross-checked under react-jsx from studio */}
        <Builtin fireAction={fireAction} props={builtinProps}>
          {children}
        </Builtin>
      </div>
    );
  }

  // Local components pin a sentinel `contentHash: ""`, so they resolve by
  // `componentPath` from `localTrees`; catalog nodes resolve by contentHash.
  const isLocal = node.data.componentSource === "local" && node.data.componentPath !== "";
  const candidateTrees = isLocal
    ? componentArtifacts?.localTrees?.[node.data.componentPath]
    : componentArtifacts?.trees[node.data.contentHash];
  const tree = pickPreviewTree(candidateTrees, node.data.previewState);

  if (!tree) {
    // Local instances carry a `componentSlug` sentinel of `""`; label them by
    // their referenced file path instead.
    const label = isLocal ? node.data.componentPath : node.data.componentSlug;
    return (
      <div data-node-id={node.id} style={PLACEHOLDER_STYLES}>
        {`Component "${label}" preview unavailable`}
      </div>
    );
  }

  return (
    <div data-node-id={node.id} style={{ display: "contents" }}>
      <PreviewNodeView fireAction={fireAction} node={tree.root} slot={children} />
    </div>
  );
}
