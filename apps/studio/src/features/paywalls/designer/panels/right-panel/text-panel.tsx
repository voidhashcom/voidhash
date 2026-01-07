"use client";

import type { TextNodeData } from "@voidhash/mimic-schema";

import {
  addTextNodeState,
  addTextNodeVariable,
  removeTextNodeState,
  removeTextNodeVariable,
  updateTextNode,
  updateTextNodeState,
  updateTextNodeVariable,
} from "../../state/actions";
import { usePaywallDesignerActions } from "../../state/designer-store";
import { StatesSection } from "./sections/states-section";
import { TextFillSection } from "./sections/text-fill-section";
import { TypographySection } from "./sections/typography-section";
import { VariablesSection } from "./sections/variables-section";

export function TextPanel({ node }: { node: TextNodeData }) {
  const dispatch = usePaywallDesignerActions();

  const handleNodeChange = (updatedNode: typeof node.style) => {
    dispatch(updateTextNode)({
      id: node.id,
      updates: {
        style: { ...node.style, ...updatedNode },
      },
    });
  };

  return (
    <>
      <VariablesSection
        node={node}
        onAddVariable={(nodeId, type, name) =>
          dispatch(addTextNodeVariable)({ name, nodeId, type })
        }
        onRemoveVariable={(nodeId, variableId) =>
          dispatch(removeTextNodeVariable)({ nodeId, variableId })
        }
        onUpdateVariable={(nodeId, variableId, updates) =>
          dispatch(updateTextNodeVariable)({
            nodeId,
            variableId,
            ...updates,
          })
        }
      />
      <StatesSection
        node={node}
        onAddState={(nodeId, name, condition) =>
          dispatch(addTextNodeState)({ condition, name, nodeId })
        }
        onRemoveState={(nodeId, stateId) =>
          dispatch(removeTextNodeState)({ nodeId, stateId })
        }
        onUpdateState={(nodeId, stateId, updates) =>
          dispatch(updateTextNodeState)({
            nodeId,
            stateId,
            ...updates,
          })
        }
      />
      <TypographySection node={node.style} onNodeChange={handleNodeChange} />
      <TextFillSection node={node.style} onNodeChange={handleNodeChange} />
    </>
  );
}
