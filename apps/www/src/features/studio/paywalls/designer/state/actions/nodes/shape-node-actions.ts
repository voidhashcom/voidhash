import type { Primitive } from "@voidhash/mimic-core";
import { parseSvg, type ShapeNode } from "@voidhash/mimic-schema";

import { commander } from "../../designer-commander";
import {
  type ShapeNodePreviousValues,
  restoreShapeNodeData,
  updateShapeNodeData,
} from "../../utils/node-data-writes";
import { selectNode } from "../selection-actions";
import { setActiveTool } from "../tools-actions";

type ShapeNodeDataPrimitive = Primitive.InferTreeNodeData<typeof ShapeNode>;

type ShapeNodeInitialValues = NonNullable<Primitive.InferInput<ShapeNodeDataPrimitive>>;

/**
 * Create a shape node from an SVG string.
 * Parses the SVG and creates a ShapeNode with PathNode children. Parser
 * `null` fields (transform, width/height) normalize to absence at the write
 * boundary — the schema has no null values.
 */
export const createShapeFromSvg = commander.undoableAction<
  {
    parentId: string;
    svgSource: string;
    beforeSiblingId?: string | null;
  },
  { nodeId: string | null; pathIds: string[] }
>(
  (ctx, params) => {
    const { mimic } = ctx.getState();

    const parsed = parseSvg(params.svgSource);
    if (parsed.paths.length === 0) {
      return { nodeId: null, pathIds: [] };
    }

    const pathIds: string[] = [];

    const shapeNodeId = mimic.document.transaction((root) => {
      const parent = root.findByIdAcrossTree(params.parentId);
      if (parent === undefined) {
        return null;
      }

      try {
        // Create the shape node
        const shape = parent.children.insertLast({
          type: "shape",
          name: "Shape",
          svgSource: params.svgSource,
          viewBox: parsed.viewBox,
          style: {
            width: parsed.width ?? parsed.viewBox.width,
            height: parsed.height ?? parsed.viewBox.height,
          },
        });

        // Create path nodes as children
        for (const path of parsed.paths) {
          const pathNode = shape.children.insertLast({
            type: "path",
            name: path.name,
            d: path.d,
            transform: path.transform ?? undefined,
            style: {
              fillColor: path.fillColor,
              fillEnabled: path.fillEnabled,
              fillRule: path.fillRule,
              fillOpacity: path.fillOpacity,
              strokeColor: path.strokeColor,
              strokeEnabled: path.strokeEnabled,
              strokeWidth: path.strokeWidth,
              strokeOpacity: path.strokeOpacity,
              strokeLinecap: path.strokeLinecap,
              strokeLinejoin: path.strokeLinejoin,
            },
          });
          pathIds.push(pathNode.id);
        }

        return shape.id;
      } catch {
        return null;
      }
    });

    if (shapeNodeId) {
      ctx.dispatch(selectNode)({ id: shapeNodeId, many: false });
      ctx.dispatch(setActiveTool)({ tool: "cursor" });
    }

    return { nodeId: shapeNodeId, pathIds };
  },
  (ctx, _params, result) => {
    if (result.nodeId === null) return;

    const { mimic } = ctx.getState();
    const { nodeId } = result;
    mimic.document.transaction((root) => {
      // Removing the shape node will also remove all its children
      root.findByIdAcrossTree(nodeId)?.remove();
    });
  },
);

/**
 * Create a shape node with initial values (for paste without SVG parsing).
 */
export const createShapeNode = commander.undoableAction<
  {
    parentId: string;
    beforeSiblingId?: string | null;
    initialValues?: ShapeNodeInitialValues;
  },
  { nodeId: string | null }
>(
  (ctx, params) => {
    const { mimic } = ctx.getState();

    const newNodeId = mimic.document.transaction((root) => {
      const parent = root.findByIdAcrossTree(params.parentId);
      if (parent === undefined) {
        return null;
      }
      try {
        return parent.children.insertLast({ ...(params.initialValues ?? {}), type: "shape" }).id;
      } catch {
        return null;
      }
    });

    if (newNodeId) {
      ctx.dispatch(selectNode)({ id: newNodeId, many: false });
      ctx.dispatch(setActiveTool)({ tool: "cursor" });
    }

    return { nodeId: newNodeId };
  },
  (ctx, _params, result) => {
    if (result.nodeId === null) return;

    const { mimic } = ctx.getState();
    const { nodeId } = result;
    mimic.document.transaction((root) => {
      root.findByIdAcrossTree(nodeId)?.remove();
    });
  },
);

/**
 * Updates a shape node's restorable fields (name, style, svgSource, viewBox).
 * Undo restores only the fields the update touched; array fields (`states`,
 * `localVariables`) must go through their dedicated actions — snapshot
 * entries are `{id, pos, value}`-wrapped and cannot replay through `update`.
 */
export const updateShapeNode = commander.undoableAction<
  {
    id: string;
    updates: Primitive.InferUpdateInput<ShapeNodeDataPrimitive>;
  },
  { previousValues: ShapeNodePreviousValues | null }
>(
  (ctx, params) => {
    const { mimic } = ctx.getState();
    const previousValues = mimic.document.transaction((root) =>
      updateShapeNodeData(root, params.id, params.updates),
    );
    return { previousValues: previousValues ?? null };
  },
  (ctx, params, result) => {
    const { previousValues } = result;
    if (previousValues === null) return;

    const { mimic } = ctx.getState();
    mimic.document.transaction((root) => {
      restoreShapeNodeData(root, params.id, previousValues);
    });
  },
);
