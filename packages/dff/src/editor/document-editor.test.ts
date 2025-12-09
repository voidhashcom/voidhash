import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PaywallDocument } from '../documents';
import { FlexNode } from '../nodes';
import type { DocumentSnapshot, StorageProvider } from '../storage';
import {
  DocumentEditor,
  NodeNotFoundError,
  ValidationError
} from './document-editor';

/** Create a mock storage provider for testing */
function createMockStorage(): StorageProvider & {
  getSnapshot: () => DocumentSnapshot;
  savedSnapshots: DocumentSnapshot[];
} {
  let snapshot: DocumentSnapshot = { meta: null, nodes: {} };
  const savedSnapshots: DocumentSnapshot[] = [];

  return {
    load: () => ({ ...snapshot, nodes: { ...snapshot.nodes } }),
    save: (s) => {
      snapshot = { ...s, nodes: { ...s.nodes } };
      savedSnapshots.push({ ...s, nodes: { ...s.nodes } });
    },
    observe: vi.fn(() => vi.fn()),
    getSnapshot: () => snapshot,
    savedSnapshots
  };
}

describe('DocumentEditor', () => {
  let editor: DocumentEditor<PaywallDocument>;
  const document = new PaywallDocument();

  beforeEach(() => {
    editor = new DocumentEditor(document);
  });

  describe('initialize', () => {
    it('should set document metadata', () => {
      editor.initialize();

      const meta = editor.getMeta();
      expect(meta).toEqual({
        schemaVersion: 1,
        documentType: 'paywall'
      });
    });
  });

  describe('getMeta', () => {
    it('should return null when not initialized', () => {
      expect(editor.getMeta()).toBeNull();
    });

    it('should return metadata after initialization', () => {
      editor.initialize();

      const meta = editor.getMeta();
      expect(meta).not.toBeNull();
      expect(meta?.schemaVersion).toBe(1);
      expect(meta?.documentType).toBe('paywall');
    });
  });

  describe('createRootNode', () => {
    it('should create a root node with default id', () => {
      editor.createRootNode();

      expect(editor.hasNode('root')).toBe(true);
      const node = editor.getNode('root') as Record<string, unknown>;
      expect(node.type).toBe('root');
      expect(node.id).toBe('root');
    });

    it('should create a root node with custom id', () => {
      editor.createRootNode('custom-root');

      expect(editor.hasNode('custom-root')).toBe(true);
      const node = editor.getNode('custom-root') as Record<string, unknown>;
      expect(node.type).toBe('root');
      expect(node.id).toBe('custom-root');
    });
  });

  describe('hasNode', () => {
    it('should return false for non-existent node', () => {
      expect(editor.hasNode('non-existent')).toBe(false);
    });

    it('should return true for existing node', () => {
      editor.createRootNode();

      expect(editor.hasNode('root')).toBe(true);
    });
  });

  describe('getNode', () => {
    it('should throw NodeNotFoundError for non-existent node', () => {
      expect(() => editor.getNode('non-existent')).toThrow(NodeNotFoundError);
      expect(() => editor.getNode('non-existent')).toThrow(
        'Node not found: non-existent'
      );
    });

    it('should return node data for existing node', () => {
      editor.createRootNode();

      const node = editor.getNode('root');
      expect(node).toEqual({ type: 'root', id: 'root' });
    });
  });

  describe('getNodeOrUndefined', () => {
    it('should return undefined for non-existent node', () => {
      expect(editor.getNodeOrUndefined('non-existent')).toBeUndefined();
    });

    it('should return node data for existing node', () => {
      editor.createRootNode();

      const node = editor.getNodeOrUndefined('root');
      expect(node).toEqual({ type: 'root', id: 'root' });
    });
  });

  describe('setNode', () => {
    it('should throw ValidationError for node without id', () => {
      expect(() => editor.setNode({ type: 'root' })).toThrow(ValidationError);
      expect(() => editor.setNode({ type: 'root' })).toThrow(
        'Node must have a string id'
      );
    });

    it('should throw ValidationError for invalid node data', () => {
      expect(() =>
        editor.setNode({
          id: 'invalid',
          type: 'flex'
          // Missing required fields
        })
      ).toThrow(ValidationError);
    });

    it('should set valid root node', () => {
      editor.setNode({ id: 'root', type: 'root' });

      expect(editor.hasNode('root')).toBe(true);
    });

    it('should throw ValidationError when setting node with invalid parent type', () => {
      editor.createRootNode();
      editor.createNode('screen', {
        id: 'screen-1',
        parent: { id: 'root', index: 'a' }
      });
      editor.createNode('text', {
        id: 'text-1',
        parent: { id: 'screen-1', index: 'a' }
      });

      // Try to set a flex node under a text node (text nodes can't have children)
      expect(() =>
        editor.setNode({
          id: 'flex-1',
          type: 'flex',
          name: 'Flex',
          parent: { id: 'text-1', index: 'a' },
          // Required flex node properties
          paddingTop: 0,
          paddingRight: 0,
          paddingBottom: 0,
          paddingLeft: 0,
          marginTop: 0,
          marginRight: 0,
          marginBottom: 0,
          marginLeft: 0,
          flexDirection: 'row',
          flexWrap: 'nowrap',
          justifyContent: 'flex-start',
          alignItems: 'stretch',
          alignContent: 'stretch',
          minWidth: null,
          maxWidth: null,
          minHeight: null,
          maxHeight: null,
          backgroundEnabled: false,
          backgroundColor: 'rgba(0, 0, 0, 0)',
          borderTopWidth: 0,
          borderRightWidth: 0,
          borderBottomWidth: 0,
          borderLeftWidth: 0,
          borderTopColor: 'rgba(0, 0, 0, 1)',
          borderRightColor: 'rgba(0, 0, 0, 1)',
          borderBottomColor: 'rgba(0, 0, 0, 1)',
          borderLeftColor: 'rgba(0, 0, 0, 1)',
          borderRadiusTopLeft: 0,
          borderRadiusTopRight: 0,
          borderRadiusBottomRight: 0,
          borderRadiusBottomLeft: 0,
          opacity: 1,
          flexGrow: 0,
          flexShrink: 1,
          flexBasis: 'auto',
          alignSelf: 'auto'
        })
      ).toThrow(ValidationError);
      expect(() =>
        editor.setNode({
          id: 'flex-1',
          parent: { id: 'text-1', index: 'a' },
          ...new FlexNode().getDefaults()
        })
      ).toThrow("Node type 'text' cannot have children");
    });

    it('should throw ValidationError when setting node that parent does not accept', () => {
      editor.createRootNode();

      // Try to set a flex node under root (root only accepts screen)
      expect(() =>
        editor.setNode({
          id: 'flex-1',
          parent: { id: 'root', index: 'a' },
          ...new FlexNode().getDefaults()
        })
      ).toThrow(ValidationError);
      expect(() =>
        editor.setNode({
          ...new FlexNode().getDefaults(),
          id: 'flex-1',
          parent: { id: 'root', index: 'a' }
        })
      ).toThrow("Node type 'root' does not accept 'flex' as children");
    });
  });

  describe('createNode', () => {
    beforeEach(() => {
      editor.createRootNode();
    });

    it('should create a node with defaults merged with provided data', () => {
      const nodeData = editor.createNode('screen', {
        id: 'screen-1',
        parent: { id: 'root', index: 'a' }
      });

      expect(nodeData.type).toBe('screen');
      expect(nodeData.id).toBe('screen-1');
      expect(nodeData.parent).toEqual({ id: 'root', index: 'a' });
      // Should have default name from node class
      expect(nodeData.name).toBe('Screen');
    });

    it('should allow overriding default values', () => {
      const nodeData = editor.createNode('screen', {
        id: 'screen-1',
        parent: { id: 'root', index: 'a' },
        name: 'Custom Screen Name'
      });

      expect(nodeData.name).toBe('Custom Screen Name');
    });

    it('should throw ValidationError for unknown node type', () => {
      expect(() =>
        editor.createNode('unknown-type', {
          id: 'unknown-1',
          parent: { id: 'root', index: 'a' }
        })
      ).toThrow(ValidationError);
      expect(() =>
        editor.createNode('unknown-type', {
          id: 'unknown-1',
          parent: { id: 'root', index: 'a' }
        })
      ).toThrow('Unknown node type: unknown-type');
    });

    it('should store the created node', () => {
      editor.createNode('screen', {
        id: 'screen-1',
        parent: { id: 'root', index: 'a' }
      });

      expect(editor.hasNode('screen-1')).toBe(true);
    });

    it('should throw ValidationError when creating node with invalid parent type', () => {
      editor.createRootNode();
      editor.createNode('screen', {
        id: 'screen-1',
        parent: { id: 'root', index: 'a' }
      });
      editor.createNode('text', {
        id: 'text-1',
        parent: { id: 'screen-1', index: 'a' }
      });

      // Try to create a screen node under a text node (text nodes can't have children)
      expect(() =>
        editor.createNode('screen', {
          id: 'screen-2',
          parent: { id: 'text-1', index: 'a' }
        })
      ).toThrow(ValidationError);
      expect(() =>
        editor.createNode('screen', {
          id: 'screen-2',
          parent: { id: 'text-1', index: 'a' }
        })
      ).toThrow("Node type 'text' cannot have children");
    });

    it('should throw ValidationError when creating node that parent does not accept', () => {
      editor.createRootNode();

      // Try to create a flex node under root (root only accepts screen)
      expect(() =>
        editor.createNode('flex', {
          id: 'flex-1',
          parent: { id: 'root', index: 'a' }
        })
      ).toThrow(ValidationError);
      expect(() =>
        editor.createNode('flex', {
          id: 'flex-1',
          parent: { id: 'root', index: 'a' }
        })
      ).toThrow("Node type 'root' does not accept 'flex' as children");
    });
  });

  describe('updateNode', () => {
    beforeEach(() => {
      editor.createRootNode();
      editor.createNode('screen', {
        id: 'screen-1',
        parent: { id: 'root', index: 'a' }
      });
    });

    it('should throw NodeNotFoundError for non-existent node', () => {
      expect(() =>
        editor.updateNode('non-existent', { name: 'New Name' })
      ).toThrow(NodeNotFoundError);
    });

    it('should merge updates with existing node data', () => {
      editor.updateNode('screen-1', { name: 'Updated Screen' });

      const node = editor.getNode('screen-1') as Record<string, unknown>;
      expect(node.name).toBe('Updated Screen');
      expect(node.type).toBe('screen');
      expect(node.parent).toEqual({ id: 'root', index: 'a' });
    });

    it('should not allow changing node id via updates', () => {
      editor.updateNode('screen-1', { id: 'new-id' });

      // The id should remain unchanged
      expect(editor.hasNode('screen-1')).toBe(true);
      const node = editor.getNode('screen-1') as Record<string, unknown>;
      expect(node.id).toBe('screen-1');
    });
  });

  describe('deleteNode', () => {
    it('should throw NodeNotFoundError for non-existent node', () => {
      expect(() => editor.deleteNode('non-existent')).toThrow(
        NodeNotFoundError
      );
    });

    it('should delete existing node', () => {
      editor.createRootNode();

      editor.deleteNode('root');

      expect(editor.hasNode('root')).toBe(false);
    });
  });

  describe('getAllNodes', () => {
    it('should return empty object when no nodes exist', () => {
      expect(editor.getAllNodes()).toEqual({});
    });

    it('should return all nodes as a record', () => {
      editor.createRootNode();
      editor.createNode('screen', {
        id: 'screen-1',
        parent: { id: 'root', index: 'a' }
      });

      const nodes = editor.getAllNodes();

      expect(Object.keys(nodes)).toHaveLength(2);
      expect(nodes.root).toEqual({ type: 'root', id: 'root' });
      expect(nodes['screen-1']).toBeDefined();
    });
  });

  describe('getNodeIds', () => {
    it('should return empty array when no nodes exist', () => {
      expect(editor.getNodeIds()).toEqual([]);
    });

    it('should return all node ids', () => {
      editor.createRootNode();
      editor.createNode('screen', {
        id: 'screen-1',
        parent: { id: 'root', index: 'a' }
      });

      const ids = editor.getNodeIds();

      expect(ids).toHaveLength(2);
      expect(ids).toContain('root');
      expect(ids).toContain('screen-1');
    });
  });

  describe('size', () => {
    it('should return 0 when no nodes exist', () => {
      expect(editor.size).toBe(0);
    });

    it('should return the number of nodes', () => {
      editor.createRootNode();
      editor.createNode('screen', {
        id: 'screen-1',
        parent: { id: 'root', index: 'a' }
      });

      expect(editor.size).toBe(2);
    });
  });

  describe('updateNodeParent', () => {
    beforeEach(() => {
      editor.createRootNode();
      editor.createNode('screen', {
        id: 'screen-1',
        parent: { id: 'root', index: 'a' }
      });
      editor.createNode('flex', {
        id: 'flex-1',
        parent: { id: 'screen-1', index: 'a' }
      });
    });

    it('should throw NodeNotFoundError for non-existent node', () => {
      expect(() =>
        editor.updateNodeParent('non-existent', { id: 'root', index: 'b' })
      ).toThrow(NodeNotFoundError);
    });

    it('should throw ValidationError when updating parent of root node', () => {
      expect(() =>
        editor.updateNodeParent('root', { id: 'root', index: 'a' })
      ).toThrow(ValidationError);
      expect(() =>
        editor.updateNodeParent('root', { id: 'root', index: 'a' })
      ).toThrow('Cannot update parent of root node');
    });

    it('should update node parent', () => {
      editor.updateNodeParent('flex-1', { id: 'screen-1', index: 'b' });

      const node = editor.getNode('flex-1') as Record<string, unknown>;
      expect(node.parent).toEqual({ id: 'screen-1', index: 'b' });
    });

    it('should throw ValidationError when updating parent to a node that cannot have children', () => {
      editor.createRootNode();
      editor.createNode('screen', {
        id: 'screen-1',
        parent: { id: 'root', index: 'a' }
      });
      editor.createNode('flex', {
        id: 'flex-1',
        parent: { id: 'screen-1', index: 'a' }
      });
      editor.createNode('text', {
        id: 'text-1',
        parent: { id: 'screen-1', index: 'b' }
      });

      // Try to move flex node under text node (text nodes can't have children)
      expect(() =>
        editor.updateNodeParent('flex-1', { id: 'text-1', index: 'a' })
      ).toThrow(ValidationError);
      expect(() =>
        editor.updateNodeParent('flex-1', { id: 'text-1', index: 'a' })
      ).toThrow("Node type 'text' cannot have children");
    });

    it('should throw ValidationError when updating parent to a node that does not accept the child type', () => {
      editor.createRootNode();
      editor.createNode('screen', {
        id: 'screen-1',
        parent: { id: 'root', index: 'a' }
      });
      editor.createNode('flex', {
        id: 'flex-1',
        parent: { id: 'screen-1', index: 'a' }
      });

      // Try to move flex node under root (root only accepts screen)
      expect(() =>
        editor.updateNodeParent('flex-1', { id: 'root', index: 'a' })
      ).toThrow(ValidationError);
      expect(() =>
        editor.updateNodeParent('flex-1', { id: 'root', index: 'a' })
      ).toThrow("Node type 'root' does not accept 'flex' as children");
    });
  });

  describe('transact', () => {
    it('should batch multiple operations', () => {
      const storage = createMockStorage();
      const editorWithStorage = new DocumentEditor(document, {
        primaryStorage: storage
      });

      editorWithStorage.transact(() => {
        editorWithStorage.createRootNode();
        editorWithStorage.createNode('screen', {
          id: 'screen-1',
          parent: { id: 'root', index: 'a' }
        });
      });

      // Only one save call for the entire transaction
      expect(storage.savedSnapshots).toHaveLength(1);
      const savedNodes = storage.savedSnapshots.at(0)?.nodes ?? {};
      expect(Object.keys(savedNodes)).toHaveLength(2);
    });
  });
});

describe('DocumentEditor with storage', () => {
  const document = new PaywallDocument();

  it('should load initial state from storage', () => {
    const storage = createMockStorage();
    storage.save({
      meta: { schemaVersion: 1, documentType: 'paywall' },
      nodes: { root: { type: 'root', id: 'root' } }
    });

    const editor = new DocumentEditor(document, { primaryStorage: storage });

    expect(editor.hasNode('root')).toBe(true);
    expect(editor.getMeta()).toEqual({
      schemaVersion: 1,
      documentType: 'paywall'
    });
  });

  it('should persist changes to primary storage', () => {
    const storage = createMockStorage();
    const editor = new DocumentEditor(document, { primaryStorage: storage });

    editor.createRootNode();

    const snapshot = storage.getSnapshot();
    expect(snapshot.nodes.root).toEqual({ type: 'root', id: 'root' });
  });

  it('should persist changes to write-only storages', () => {
    const primary = createMockStorage();
    const writeOnly1 = createMockStorage();
    const writeOnly2 = createMockStorage();
    const editor = new DocumentEditor(document, {
      primaryStorage: primary,
      writeOnlyStorages: [writeOnly1, writeOnly2]
    });

    editor.createRootNode();

    expect(primary.getSnapshot().nodes.root).toEqual({
      type: 'root',
      id: 'root'
    });
    expect(writeOnly1.getSnapshot().nodes.root).toEqual({
      type: 'root',
      id: 'root'
    });
    expect(writeOnly2.getSnapshot().nodes.root).toEqual({
      type: 'root',
      id: 'root'
    });
  });

  it('should not load from write-only storages', () => {
    const primary = createMockStorage();
    const writeOnly = createMockStorage();
    writeOnly.save({
      meta: { schemaVersion: 1, documentType: 'paywall' },
      nodes: { root: { type: 'root', id: 'root' } }
    });

    const editor = new DocumentEditor(document, {
      primaryStorage: primary,
      writeOnlyStorages: [writeOnly]
    });

    // Should not have loaded from write-only storage
    expect(editor.hasNode('root')).toBe(false);
  });
});

describe('NodeNotFoundError', () => {
  it('should have correct name and nodeId', () => {
    const error = new NodeNotFoundError('test-id');

    expect(error.name).toBe('NodeNotFoundError');
    expect(error.nodeId).toBe('test-id');
    expect(error.message).toBe('Node not found: test-id');
  });
});

describe('ValidationError', () => {
  it('should have correct name, nodeId, and reason', () => {
    const error = new ValidationError('test-id', 'Invalid data');

    expect(error.name).toBe('ValidationError');
    expect(error.nodeId).toBe('test-id');
    expect(error.reason).toBe('Invalid data');
    expect(error.message).toBe('Validation failed for test-id: Invalid data');
  });
});
