/** biome-ignore-all lint/suspicious/noExplicitAny: test utilities use any for flexibility */
/** biome-ignore-all lint/style/noNonNullAssertion: test assertions use non-null for clarity */
import { beforeEach, describe, expect, it } from 'vitest';
import { paywallDocument } from '../documents/paywall-document';
import { getDefaults, type ObjectSchema } from '../schema';
import { createEditor } from './create-editor';
import { NodeNotFoundError, ValidationError } from './errors';
import type { Editor } from './types';

// ============================================================================
// Test Fixtures
// ============================================================================

function createTestRootNode(id = 'root') {
  return {
    type: 'root' as const,
    id
  };
}

function createTestScreenNode(id: string, name = 'Screen', index = 'a0') {
  const screenNodeShape = (
    paywallDocument.nodes.screen as unknown as ObjectSchema<any>
  ).shape;
  const styleSchema = screenNodeShape.style as ObjectSchema<any>;
  const styleDefaults = getDefaults(styleSchema);

  return {
    type: 'screen' as const,
    id,
    name,
    parent: { id: 'root', index },
    localVariables: [],
    linkedVariables: [],
    style: styleDefaults
  };
}

function createTestFlexNode(
  id: string,
  parentId: string,
  name = 'Flex',
  index = 'a0'
) {
  const flexNodeShape = (
    paywallDocument.nodes.flex as unknown as ObjectSchema<any>
  ).shape;
  const styleSchema = flexNodeShape.style as ObjectSchema<any>;
  const styleDefaults = getDefaults(styleSchema);

  return {
    type: 'flex' as const,
    id,
    name,
    parent: { id: parentId, index },
    localVariables: [],
    linkedVariables: [],
    style: styleDefaults
  };
}

function createTestTextNode(
  id: string,
  parentId: string,
  name = 'Text',
  index = 'a0'
) {
  const textNodeShape = (
    paywallDocument.nodes.text as unknown as ObjectSchema<any>
  ).shape;
  const styleSchema = textNodeShape.style as ObjectSchema<any>;
  const styleDefaults = getDefaults(styleSchema);

  return {
    type: 'text' as const,
    id,
    name,
    parent: { id: parentId, index },
    localVariables: [],
    linkedVariables: [],
    style: styleDefaults,
    content: 'Hello'
  };
}

// ============================================================================
// Tree Utilities Tests
// ============================================================================

describe('TreeUtils', () => {
  let editor: Editor<typeof paywallDocument>;

  beforeEach(() => {
    editor = createEditor(paywallDocument, {
      initialNodes: {
        root: createTestRootNode(),
        'screen-1': createTestScreenNode('screen-1', 'Screen 1', 'a0'),
        'screen-2': createTestScreenNode('screen-2', 'Screen 2', 'a1'),
        'flex-1': createTestFlexNode('flex-1', 'screen-1', 'Flex 1', 'a0'),
        'flex-2': createTestFlexNode('flex-2', 'screen-1', 'Flex 2', 'a1'),
        'text-1': createTestTextNode('text-1', 'flex-1', 'Text 1', 'a0')
      }
    });
  });

  describe('getChildren', () => {
    it('should return direct children of a node', () => {
      const children = editor.tree.getChildren('screen-1');
      const childIds = children.map((h) => (h.get() as any).id);

      expect(childIds).toHaveLength(2);
      expect(childIds).toContain('flex-1');
      expect(childIds).toContain('flex-2');
    });

    it('should return empty array for leaf nodes', () => {
      const children = editor.tree.getChildren('text-1');
      expect(children).toHaveLength(0);
    });
  });

  describe('getSortedChildren', () => {
    it('should return children sorted by index', () => {
      const children = editor.tree.getSortedChildren('root');
      const childIds = children.map((h) => (h.get() as any).id);

      expect(childIds).toEqual(['screen-1', 'screen-2']);
    });
  });

  describe('getDescendants', () => {
    it('should return all descendants of a node', () => {
      const descendants = editor.tree.getDescendants('screen-1');
      const descendantIds = descendants.map((h) => (h.get() as any).id);

      expect(descendantIds).toHaveLength(3);
      expect(descendantIds).toContain('flex-1');
      expect(descendantIds).toContain('flex-2');
      expect(descendantIds).toContain('text-1');
    });

    it('should return empty array for leaf nodes', () => {
      const descendants = editor.tree.getDescendants('text-1');
      expect(descendants).toHaveLength(0);
    });
  });

  describe('getAncestors', () => {
    it('should return ancestors from immediate parent to root', () => {
      const ancestors = editor.tree.getAncestors('text-1');
      const ancestorIds = ancestors.map((h) => (h.get() as any).id);

      expect(ancestorIds).toEqual(['flex-1', 'screen-1', 'root']);
    });

    it('should return empty array for root node', () => {
      const ancestors = editor.tree.getAncestors('root');
      expect(ancestors).toHaveLength(0);
    });
  });

  describe('isDescendantOf', () => {
    it('should return true for direct children', () => {
      expect(editor.tree.isDescendantOf('flex-1', 'screen-1')).toBe(true);
    });

    it('should return true for nested descendants', () => {
      expect(editor.tree.isDescendantOf('text-1', 'screen-1')).toBe(true);
    });

    it('should return false for siblings', () => {
      expect(editor.tree.isDescendantOf('flex-1', 'flex-2')).toBe(false);
    });

    it('should return false for same node', () => {
      expect(editor.tree.isDescendantOf('flex-1', 'flex-1')).toBe(false);
    });

    it('should return false for parent', () => {
      expect(editor.tree.isDescendantOf('screen-1', 'flex-1')).toBe(false);
    });
  });

  describe('getParent', () => {
    it('should return parent handle', () => {
      const parent = editor.tree.getParent('flex-1');
      expect(parent).toBeDefined();
      expect((parent?.get() as any).id).toBe('screen-1');
    });

    it('should return undefined for root node', () => {
      const parent = editor.tree.getParent('root');
      expect(parent).toBeUndefined();
    });
  });
});

// ============================================================================
// Commands Tests
// ============================================================================

describe('EditorCommands', () => {
  let editor: Editor<typeof paywallDocument>;

  beforeEach(() => {
    editor = createEditor(paywallDocument, {
      initialNodes: {
        root: createTestRootNode(),
        'screen-1': createTestScreenNode('screen-1', 'Screen 1', 'a0')
      }
    });
  });

  describe('createNode', () => {
    it('should create a node with auto-generated ID', () => {
      const handle = editor.commands.createNode('flex', {
        parentId: 'screen-1'
      });

      const node = handle.get() as any;
      expect(node.type).toBe('flex');
      expect(node.id).toBeDefined();
      expect(node.parent.id).toBe('screen-1');
    });

    it('should create a node with custom ID', () => {
      const handle = editor.commands.createNode('flex', {
        id: 'custom-flex-1',
        parentId: 'screen-1'
      });

      const node = handle.get() as any;
      expect(node.id).toBe('custom-flex-1');
    });

    it('should create node at end by default', () => {
      // Create two nodes
      editor.commands.createNode('flex', {
        id: 'flex-1',
        parentId: 'screen-1'
      });
      editor.commands.createNode('flex', {
        id: 'flex-2',
        parentId: 'screen-1'
      });

      const children = editor.tree.getSortedChildren('screen-1');
      const childIds = children.map((h) => (h.get() as any).id);

      expect(childIds).toEqual(['flex-1', 'flex-2']);
    });

    it('should create node before specified sibling', () => {
      editor.commands.createNode('flex', {
        id: 'flex-1',
        parentId: 'screen-1'
      });
      editor.commands.createNode('flex', {
        id: 'flex-2',
        parentId: 'screen-1'
      });
      editor.commands.createNode('flex', {
        id: 'flex-3',
        parentId: 'screen-1',
        beforeSiblingId: 'flex-2'
      });

      const children = editor.tree.getSortedChildren('screen-1');
      const childIds = children.map((h) => (h.get() as any).id);

      expect(childIds).toEqual(['flex-1', 'flex-3', 'flex-2']);
    });

    it('should throw NodeNotFoundError for non-existent parent', () => {
      expect(() => {
        editor.commands.createNode('flex', {
          parentId: 'non-existent'
        });
      }).toThrow(NodeNotFoundError);
    });

    it('should merge custom data with defaults', () => {
      const handle = editor.commands.createNode('flex', {
        parentId: 'screen-1',
        data: { name: 'Custom Flex' }
      });

      const node = handle.get() as any;
      expect(node.name).toBe('Custom Flex');
      expect(node.style).toBeDefined(); // Defaults should be applied
    });
  });

  describe('deleteSubtree', () => {
    it('should delete a single node', () => {
      editor.commands.createNode('flex', {
        id: 'flex-1',
        parentId: 'screen-1'
      });

      editor.commands.deleteSubtree('flex-1');

      expect(editor.nodes.get('flex-1')).toBeUndefined();
    });

    it('should delete node and all descendants', () => {
      editor.commands.createNode('flex', {
        id: 'flex-1',
        parentId: 'screen-1'
      });
      editor.commands.createNode('text', { id: 'text-1', parentId: 'flex-1' });
      editor.commands.createNode('flex', { id: 'flex-2', parentId: 'flex-1' });
      editor.commands.createNode('text', { id: 'text-2', parentId: 'flex-2' });

      editor.commands.deleteSubtree('flex-1');

      expect(editor.nodes.get('flex-1')).toBeUndefined();
      expect(editor.nodes.get('text-1')).toBeUndefined();
      expect(editor.nodes.get('flex-2')).toBeUndefined();
      expect(editor.nodes.get('text-2')).toBeUndefined();
    });

    it('should throw NodeNotFoundError for non-existent node', () => {
      expect(() => {
        editor.commands.deleteSubtree('non-existent');
      }).toThrow(NodeNotFoundError);
    });
  });

  describe('moveNode', () => {
    beforeEach(() => {
      // Set up a more complex tree
      editor = createEditor(paywallDocument, {
        initialNodes: {
          root: createTestRootNode(),
          'screen-1': createTestScreenNode('screen-1', 'Screen 1', 'a0'),
          'screen-2': createTestScreenNode('screen-2', 'Screen 2', 'a1'),
          'flex-1': createTestFlexNode('flex-1', 'screen-1', 'Flex 1', 'a0'),
          'flex-2': createTestFlexNode('flex-2', 'screen-1', 'Flex 2', 'a1'),
          'text-1': createTestTextNode('text-1', 'flex-1', 'Text 1', 'a0')
        }
      });
    });

    it('should move node to different parent', () => {
      editor.commands.moveNode('flex-1', { parentId: 'screen-2' });

      const node = editor.nodes.get('flex-1')?.get() as any;
      expect(node.parent.id).toBe('screen-2');
    });

    it('should move node before specified sibling', () => {
      editor.commands.moveNode('flex-2', {
        parentId: 'screen-1',
        beforeSiblingId: 'flex-1'
      });

      const children = editor.tree.getSortedChildren('screen-1');
      const childIds = children.map((h) => (h.get() as any).id);

      expect(childIds).toEqual(['flex-2', 'flex-1']);
    });

    it('should throw ValidationError when moving node into itself', () => {
      expect(() => {
        editor.commands.moveNode('flex-1', { parentId: 'flex-1' });
      }).toThrow(ValidationError);
    });

    it('should throw ValidationError when moving node into its descendant', () => {
      expect(() => {
        editor.commands.moveNode('flex-1', { parentId: 'text-1' });
      }).toThrow(ValidationError);
    });

    it('should throw NodeNotFoundError for non-existent node', () => {
      expect(() => {
        editor.commands.moveNode('non-existent', { parentId: 'screen-1' });
      }).toThrow(NodeNotFoundError);
    });

    it('should throw NodeNotFoundError for non-existent parent', () => {
      expect(() => {
        editor.commands.moveNode('flex-1', { parentId: 'non-existent' });
      }).toThrow(NodeNotFoundError);
    });
  });
});

// ============================================================================
// Serialization Tests
// ============================================================================

describe('SerializationUtils', () => {
  let editor: Editor<typeof paywallDocument>;

  beforeEach(() => {
    editor = createEditor(paywallDocument, {
      initialNodes: {
        root: createTestRootNode(),
        'screen-1': createTestScreenNode('screen-1', 'Screen 1', 'a0'),
        'flex-1': createTestFlexNode('flex-1', 'screen-1', 'Flex 1', 'a0'),
        'flex-2': createTestFlexNode('flex-2', 'screen-1', 'Flex 2', 'a1'),
        'text-1': createTestTextNode('text-1', 'flex-1', 'Text 1', 'a0'),
        'text-2': createTestTextNode('text-2', 'flex-1', 'Text 2', 'a1')
      }
    });
  });

  describe('serializeNodes', () => {
    it('should serialize a single node', () => {
      const serialized = editor.serialization.serializeNodes(['text-1']);

      expect(serialized.nodes).toHaveLength(1);
      expect(serialized.rootNodeIds).toEqual(['text-1']);
      expect((serialized.nodes[0] as any).id).toBe('text-1');
    });

    it('should serialize node with descendants', () => {
      const serialized = editor.serialization.serializeNodes(['flex-1']);

      expect(serialized.nodes).toHaveLength(3); // flex-1, text-1, text-2
      expect(serialized.rootNodeIds).toEqual(['flex-1']);
      expect(serialized.originalParentId).toBe('screen-1');
    });

    it('should skip root nodes', () => {
      const serialized = editor.serialization.serializeNodes(['root']);

      expect(serialized.nodes).toHaveLength(0);
      expect(serialized.rootNodeIds).toHaveLength(0);
    });

    it('should serialize multiple nodes', () => {
      const serialized = editor.serialization.serializeNodes([
        'flex-1',
        'flex-2'
      ]);

      // flex-1 + text-1 + text-2 + flex-2
      expect(serialized.nodes).toHaveLength(4);
      expect(serialized.rootNodeIds).toEqual(['flex-1', 'flex-2']);
    });
  });

  describe('deserializeNodes', () => {
    it('should deserialize with new IDs', () => {
      const serialized = editor.serialization.serializeNodes(['text-1']);
      const newIds = editor.serialization.deserializeNodes(serialized, {
        parentId: 'flex-2'
      });

      expect(newIds).toHaveLength(1);
      expect(newIds[0]).not.toBe('text-1'); // New ID generated

      const newRootNodeId = newIds[0];
      if (!newRootNodeId) {
        throw new Error('No new root node id even though there should be one');
      }
      const newNode = editor.nodes.get(newRootNodeId)?.get() as any;
      expect(newNode.type).toBe('text');
      expect(newNode.parent.id).toBe('flex-2');
    });

    it('should preserve hierarchy when deserializing', () => {
      const serialized = editor.serialization.serializeNodes(['flex-1']);
      const newIds = editor.serialization.deserializeNodes(serialized, {
        parentId: 'flex-2'
      });

      expect(newIds).toHaveLength(1);

      // Check that children were also created
      const newRootNodeId = newIds[0];
      if (!newRootNodeId) {
        throw new Error('No new root node id even though there should be one');
      }
      const newFlex = editor.nodes.get(newRootNodeId)?.get() as any;
      expect(newFlex.type).toBe('flex');

      const children = editor.tree.getChildren(newRootNodeId);
      expect(children).toHaveLength(2); // text-1 and text-2 were also deserialized
    });

    it('should throw NodeNotFoundError for non-existent parent', () => {
      const serialized = editor.serialization.serializeNodes(['text-1']);

      expect(() => {
        editor.serialization.deserializeNodes(serialized, {
          parentId: 'non-existent'
        });
      }).toThrow(NodeNotFoundError);
    });

    it('should return empty array for empty data', () => {
      const newIds = editor.serialization.deserializeNodes(
        { nodes: [], rootNodeIds: [], originalParentId: null },
        { parentId: 'flex-2' }
      );

      expect(newIds).toEqual([]);
    });

    it('should preserve visual order when serializing nodes selected in reverse order', () => {
      // Serialize nodes in reverse selection order (flex-2 before flex-1)
      const serialized = editor.serialization.serializeNodes([
        'flex-2',
        'flex-1'
      ]);

      // Root node IDs should be in visual order (by fractional index), not selection order
      expect(serialized.rootNodeIds).toEqual(['flex-1', 'flex-2']);
    });

    it('should preserve order when deserializing multiple nodes', () => {
      // Serialize both flex nodes
      const serialized = editor.serialization.serializeNodes([
        'flex-1',
        'flex-2'
      ]);

      // Deserialize to a new parent
      const newIds = editor.serialization.deserializeNodes(serialized, {
        parentId: 'screen-1'
      });

      expect(newIds).toHaveLength(2);

      // Get the newly created nodes and verify they're in the correct order
      const children = editor.tree.getSortedChildren('screen-1');
      const childIds = children.map((h) => (h.get() as any).id);

      // Original flex-1 and flex-2 should come before the pasted nodes
      // Pasted nodes should maintain the same relative order as originals
      const pastedNodeIndex0 = childIds.indexOf(newIds[0]!);
      const pastedNodeIndex1 = childIds.indexOf(newIds[1]!);

      expect(pastedNodeIndex0).toBeLessThan(pastedNodeIndex1);
    });
  });
});
