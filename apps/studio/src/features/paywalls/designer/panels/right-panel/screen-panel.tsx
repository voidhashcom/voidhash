"use client";

import type { ScreenNodeData } from "@voidhash/mimic-schema";

import {
  addScreenNodeState,
  addScreenNodeVariable,
  removeScreenNodeState,
  removeScreenNodeVariable,
  updateScreenNode,
  updateScreenNodeState,
  updateScreenNodeVariable,
} from "../../state/actions";
import { usePaywallDesignerActions } from "../../state/designer-store";
import { FillSection } from "./sections/fill-section";
import { FlexLayoutSection } from "./sections/flex-layout-section";
import { StatesSection } from "./sections/states-section";
import { VariablesSection } from "./sections/variables-section";

export function ScreenPanel({ node }: { node: ScreenNodeData }) {
  const dispatch = usePaywallDesignerActions();
  return (
    <>
      <VariablesSection
        node={node}
        onAddVariable={(nodeId, type, name) =>
          dispatch(addScreenNodeVariable)({ name, nodeId, type })
        }
        onRemoveVariable={(nodeId, variableId) =>
          dispatch(removeScreenNodeVariable)({ nodeId, variableId })
        }
        onUpdateVariable={(nodeId, variableId, updates) =>
          dispatch(updateScreenNodeVariable)({
            nodeId,
            variableId,
            ...updates,
          })
        }
      />
      <StatesSection
        node={node}
        onAddState={(nodeId, name, condition) =>
          dispatch(addScreenNodeState)({ condition, name, nodeId })
        }
        onRemoveState={(nodeId, stateId) =>
          dispatch(removeScreenNodeState)({ nodeId, stateId })
        }
        onUpdateState={(nodeId, stateId, updates) =>
          dispatch(updateScreenNodeState)({
            nodeId,
            stateId,
            ...updates,
          })
        }
      />
      {node.parentId && (
        <FlexLayoutSection
          editableDimensions={false}
          node={node.style}
          onNodeChange={(updatedStyle) =>
            dispatch(updateScreenNode)({
              id: node.id,
              updates: {
                style: {
                  ...node.style,
                  ...updatedStyle,
                  width: updatedStyle.width ?? node.style.width,
                  height: updatedStyle.height ?? node.style.height,
                },
              },
            })
          }
          parentId={node.parentId}
        />
      )}
      <FillSection
        node={node.style}
        onNodeChange={(updatedStyle) =>
          dispatch(updateScreenNode)({
            id: node.id,
            updates: { style: { ...node.style, ...updatedStyle } },
          })
        }
      />
    </>
  );
}
