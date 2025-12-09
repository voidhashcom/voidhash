import { beforeEach, describe, expect, it } from 'vitest';
import { NodeNotFoundError } from './document-editor';
import { PaywallDocumentEditor } from './paywall-document-editor';

describe('PaywallDocumentEditor', () => {
  let editor: PaywallDocumentEditor;

  beforeEach(() => {
    editor = new PaywallDocumentEditor();
    editor.createRootNode();
  });

  describe('createScreen', () => {
    it('should create a screen node with defaults', () => {
      const screen = editor.createScreen({
        id: 'screen-1',
        parent: { id: 'root', index: 'a' }
      });

      expect(screen.type).toBe('screen');
      expect(screen.id).toBe('screen-1');
      expect(screen.name).toBe('Screen');
      expect(screen.parent).toEqual({ id: 'root', index: 'a' });
    });

    it('should allow overriding defaults', () => {
      const screen = editor.createScreen({
        id: 'screen-1',
        parent: { id: 'root', index: 'a' },
        name: 'Custom Screen',
        style: { width: 400 }
      });

      expect(screen.name).toBe('Custom Screen');
      expect(screen.style.width).toBe(400);
    });

    it('should store the created screen', () => {
      editor.createScreen({
        id: 'screen-1',
        parent: { id: 'root', index: 'a' }
      });

      expect(editor.hasNode('screen-1')).toBe(true);
    });
  });

  describe('createFlex', () => {
    beforeEach(() => {
      editor.createScreen({
        id: 'screen-1',
        parent: { id: 'root', index: 'a' }
      });
    });

    it('should create a flex node with defaults', () => {
      const flex = editor.createFlex({
        id: 'flex-1',
        parent: { id: 'screen-1', index: 'a' }
      });

      expect(flex.type).toBe('flex');
      expect(flex.id).toBe('flex-1');
      expect(flex.name).toBe('Flex');
      expect(flex.parent).toEqual({ id: 'screen-1', index: 'a' });
    });

    it('should allow overriding defaults', () => {
      const flex = editor.createFlex({
        id: 'flex-1',
        parent: { id: 'screen-1', index: 'a' },
        name: 'Container'
      });

      expect(flex.name).toBe('Container');
    });

    it('should store the created flex', () => {
      editor.createFlex({
        id: 'flex-1',
        parent: { id: 'screen-1', index: 'a' }
      });

      expect(editor.hasNode('flex-1')).toBe(true);
    });
  });

  describe('createText', () => {
    beforeEach(() => {
      editor.createScreen({
        id: 'screen-1',
        parent: { id: 'root', index: 'a' }
      });
    });

    it('should create a text node with defaults', () => {
      const text = editor.createText({
        id: 'text-1',
        parent: { id: 'screen-1', index: 'a' }
      });

      expect(text.type).toBe('text');
      expect(text.id).toBe('text-1');
      expect(text.name).toBe('Text');
      expect(text.parent).toEqual({ id: 'screen-1', index: 'a' });
    });

    it('should allow overriding defaults', () => {
      const text = editor.createText({
        id: 'text-1',
        parent: { id: 'screen-1', index: 'a' },
        name: 'Title'
      });

      expect(text.name).toBe('Title');
    });

    it('should store the created text', () => {
      editor.createText({
        id: 'text-1',
        parent: { id: 'screen-1', index: 'a' }
      });

      expect(editor.hasNode('text-1')).toBe(true);
    });
  });

  describe('getScreen', () => {
    it('should return screen node with proper typing', () => {
      editor.createScreen({
        id: 'screen-1',
        parent: { id: 'root', index: 'a' },
        name: 'My Screen'
      });

      const screen = editor.getScreen('screen-1');

      expect(screen.type).toBe('screen');
      expect(screen.name).toBe('My Screen');
    });

    it('should throw NodeNotFoundError for non-existent screen', () => {
      expect(() => editor.getScreen('non-existent')).toThrow(NodeNotFoundError);
    });
  });

  describe('getFlex', () => {
    beforeEach(() => {
      editor.createScreen({
        id: 'screen-1',
        parent: { id: 'root', index: 'a' }
      });
    });

    it('should return flex node with proper typing', () => {
      editor.createFlex({
        id: 'flex-1',
        parent: { id: 'screen-1', index: 'a' },
        name: 'Container'
      });

      const flex = editor.getFlex('flex-1');

      expect(flex.type).toBe('flex');
      expect(flex.name).toBe('Container');
    });

    it('should throw NodeNotFoundError for non-existent flex', () => {
      expect(() => editor.getFlex('non-existent')).toThrow(NodeNotFoundError);
    });
  });

  describe('getText', () => {
    beforeEach(() => {
      editor.createScreen({
        id: 'screen-1',
        parent: { id: 'root', index: 'a' }
      });
    });

    it('should return text node with proper typing', () => {
      editor.createText({
        id: 'text-1',
        parent: { id: 'screen-1', index: 'a' },
        name: 'Headline'
      });

      const text = editor.getText('text-1');

      expect(text.type).toBe('text');
      expect(text.name).toBe('Headline');
    });

    it('should throw NodeNotFoundError for non-existent text', () => {
      expect(() => editor.getText('non-existent')).toThrow(NodeNotFoundError);
    });
  });

  describe('integration', () => {
    it('should build a complete paywall document', () => {
      editor.initialize();

      const screen = editor.createScreen({
        id: 'screen-1',
        parent: { id: 'root', index: 'a' },
        name: 'Main Screen'
      });

      const container = editor.createFlex({
        id: 'container',
        parent: { id: 'screen-1', index: 'a' },
        name: 'Content Container'
      });

      const title = editor.createText({
        id: 'title',
        parent: { id: 'container', index: 'a' },
        name: 'Title'
      });

      const subtitle = editor.createText({
        id: 'subtitle',
        parent: { id: 'container', index: 'b' },
        name: 'Subtitle'
      });

      expect(editor.size).toBe(5); // root + screen + container + 2 texts
      expect(screen.type).toBe('screen');
      expect(container.type).toBe('flex');
      expect(title.type).toBe('text');
      expect(subtitle.type).toBe('text');
    });
  });

  describe('fromNodes', () => {
    it('should create editor from existing nodes', () => {
      const nodes = {
        root: { type: 'root', id: 'root' },
        'screen-1': {
          type: 'screen',
          id: 'screen-1',
          name: 'Test Screen',
          parent: { id: 'root', index: 'a' },
          width: 375,
          height: 812
        }
      };

      const editorFromNodes = PaywallDocumentEditor.fromNodes(nodes);

      expect(editorFromNodes.hasNode('root')).toBe(true);
      expect(editorFromNodes.hasNode('screen-1')).toBe(true);
      expect(editorFromNodes.size).toBe(2);
    });

    it('should allow typed access to nodes from Zustand state', () => {
      // Simulate nodes coming from Zustand state
      const zustandNodes = {
        root: { type: 'root', id: 'root' },
        'screen-1': {
          type: 'screen',
          id: 'screen-1',
          name: 'My Screen',
          parent: { id: 'root', index: 'a' },
          style: {
            width: 400,
            height: 800
          }
        },
        'flex-1': {
          type: 'flex',
          id: 'flex-1',
          name: 'Container',
          parent: { id: 'screen-1', index: 'a' }
        }
      };

      const editorFromNodes = PaywallDocumentEditor.fromNodes(zustandNodes);

      // Use typed accessors
      const screen = editorFromNodes.getScreen('screen-1');
      expect(screen.name).toBe('My Screen');
      expect(screen.style.width).toBe(400);

      const flex = editorFromNodes.getFlex('flex-1');
      expect(flex.name).toBe('Container');
    });

    it('should create independent copy of nodes', () => {
      const originalNodes = {
        root: { type: 'root', id: 'root' }
      };

      const editorFromNodes = PaywallDocumentEditor.fromNodes(originalNodes);

      // Modify original nodes
      originalNodes.root = { type: 'root', id: 'modified' };

      // Editor should still have original data
      const rootNode = editorFromNodes.getNode('root') as { id: string };
      expect(rootNode.id).toBe('root');
    });
  });
});
