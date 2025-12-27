'use client';

import type { FlexNodeData } from '@voidhash/mimic-schema';
import { usePaywallDesignerActions } from '../../state/designer-store';
import { BorderRadiusSection } from './sections/border-radius-section';
import { BorderSection } from './sections/border-section';
import { FillSection } from './sections/fill-section';
import { FlexLayoutSection } from './sections/flex-layout-section';
import { StatesSection } from './sections/states-section';
import { VariablesSection } from './sections/variables-section';

const DISPATCH_ACTION = 'updateFlexNode';
export function FlexPanel({ node }: { node: FlexNodeData }) {
  const dispatch = usePaywallDesignerActions();
  return (
    <>
      <VariablesSection
        node={node}
        onAddVariable={(nodeId, type, name) =>
          dispatch('addFlexNodeVariable', { nodeId, type, name })
        }
        onRemoveVariable={(nodeId, variableId) =>
          dispatch('removeFlexNodeVariable', { nodeId, variableId })
        }
        onUpdateVariable={(nodeId, variableId, updates) =>
          dispatch('updateFlexNodeVariable', {
            nodeId,
            variableId,
            ...updates
          })
        }
      />
      <StatesSection
        node={node}
        onAddState={(nodeId, name, condition) =>
          dispatch('addFlexNodeState', { nodeId, name, condition })
        }
        onRemoveState={(nodeId, stateId) =>
          dispatch('removeFlexNodeState', { nodeId, stateId })
        }
        onUpdateState={(nodeId, stateId, updates) =>
          dispatch('updateFlexNodeState', {
            nodeId,
            stateId,
            ...updates
          })
        }
      />
      <FlexLayoutSection
        node={node.data.style}
        onNodeChange={(updatedStyle) =>
          dispatch(DISPATCH_ACTION, {
            ...node,
            style: { ...node.data.style, ...updatedStyle }
          })
        }
        parentId={node.id}
      />
      <BorderRadiusSection
        node={node.data.style}
        onNodeChange={(updatedStyle) =>
          dispatch(DISPATCH_ACTION, {
            ...node,
            style: { ...node.data.style, ...updatedStyle }
          })
        }
      />
      <FillSection
        node={node.data.style}
        onNodeChange={(updatedStyle) =>
          dispatch(DISPATCH_ACTION, {
            ...node,
            style: { ...node.data.style, ...updatedStyle }
          })
        }
      />

      <BorderSection
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
