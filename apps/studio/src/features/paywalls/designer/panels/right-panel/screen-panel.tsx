'use client';

import type { ScreenNodeData } from '@voidhash/mimic-schema';
import { usePaywallDesignerActions } from '../../state/designer-store';
import { FillSection } from './sections/fill-section';
import { FlexLayoutSection } from './sections/flex-layout-section';
import { StatesSection } from './sections/states-section';
import { VariablesSection } from './sections/variables-section';

const DISPATCH_ACTION = 'updateScreenNode';
export function ScreenPanel({ node }: { node: ScreenNodeData }) {
  const dispatch = usePaywallDesignerActions();
  return (
    <>
      <VariablesSection
        node={node}
        onAddVariable={(nodeId, type, name) =>
          dispatch('addScreenNodeVariable', { nodeId, type, name })
        }
        onRemoveVariable={(nodeId, variableId) =>
          dispatch('removeScreenNodeVariable', { nodeId, variableId })
        }
        onUpdateVariable={(nodeId, variableId, updates) =>
          dispatch('updateScreenNodeVariable', {
            nodeId,
            variableId,
            ...updates
          })
        }
      />
      <StatesSection
        node={node}
        onAddState={(nodeId, name, condition) =>
          dispatch('addScreenNodeState', { nodeId, name, condition })
        }
        onRemoveState={(nodeId, stateId) =>
          dispatch('removeScreenNodeState', { nodeId, stateId })
        }
        onUpdateState={(nodeId, stateId, updates) =>
          dispatch('updateScreenNodeState', {
            nodeId,
            stateId,
            ...updates
          })
        }
      />
      {node.parentId && (
        <FlexLayoutSection
          editableDimensions={false}
          node={node.data.style}
          onNodeChange={(updatedStyle) =>
            dispatch(DISPATCH_ACTION, {
              ...node,
              style: {
                ...node.data.style,
                ...updatedStyle,
                width: updatedStyle.width ?? node.data.style.width,
                height: updatedStyle.height ?? node.data.style.height
              }
            })
          }
          parentId={node.parentId}
        />
      )}
      <FillSection
        node={node.data.style}
        onNodeChange={(updatedStyle) =>
          dispatch(DISPATCH_ACTION, {
            ...node,
            style: { ...node.data.style, ...updatedStyle }
          })
        }
      />
    </>
  );
}
