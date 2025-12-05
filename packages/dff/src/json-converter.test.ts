import { beforeEach, describe, expect, it } from 'vitest';
import { PaywallDocument } from './documents';
import { DocumentEditor, ValidationError } from './editor';
import { JsonConverter, type JsonDocument } from './json-converter';

describe('JsonConverter', () => {
  let editor: DocumentEditor<PaywallDocument>;
  let converter: JsonConverter<PaywallDocument>;
  const document = new PaywallDocument();

  beforeEach(() => {
    editor = new DocumentEditor(document);
    converter = new JsonConverter(editor);
  });

  describe('toJson', () => {
    it('should throw error when document is not initialized', () => {
      expect(() => converter.toJson()).toThrow(
        'Document not initialized: missing metadata'
      );
    });

    it('should return JSON document with metadata and nodes', () => {
      editor.initialize();
      editor.createRootNode();
      editor.createNode('screen', {
        id: 'screen-1',
        parent: { id: 'root', index: 'a' }
      });

      const json = converter.toJson();

      expect(json.meta).toEqual({
        schemaVersion: 1,
        documentType: 'paywall'
      });
      expect(Object.keys(json.nodes)).toHaveLength(2);
      expect(json.nodes.root).toEqual({ type: 'root', id: 'root' });
      expect(json.nodes['screen-1']).toBeDefined();
    });
  });

  describe('toJsonString', () => {
    beforeEach(() => {
      editor.initialize();
      editor.createRootNode();
    });

    it('should return compact JSON string by default', () => {
      const jsonString = converter.toJsonString();

      expect(jsonString).not.toContain('\n');
      const parsed = JSON.parse(jsonString);
      expect(parsed.meta.documentType).toBe('paywall');
    });

    it('should return pretty-printed JSON string when requested', () => {
      const jsonString = converter.toJsonString(true);

      expect(jsonString).toContain('\n');
      expect(jsonString).toContain('  '); // Indentation
    });
  });

  describe('fromJson', () => {
    it('should throw ValidationError for document type mismatch', () => {
      const json: JsonDocument = {
        meta: { schemaVersion: 1, documentType: 'other-type' },
        nodes: {}
      };

      expect(() => converter.fromJson(json)).toThrow(ValidationError);
      expect(() => converter.fromJson(json)).toThrow(
        "Document type mismatch: expected 'paywall', got 'other-type'"
      );
    });

    it('should throw ValidationError for newer schema version', () => {
      const json: JsonDocument = {
        meta: { schemaVersion: 999, documentType: 'paywall' },
        nodes: {}
      };

      expect(() => converter.fromJson(json)).toThrow(ValidationError);
      expect(() => converter.fromJson(json)).toThrow(
        'Schema version 999 is newer than supported version 1'
      );
    });

    it('should allow newer schema version when validation is disabled', () => {
      const json: JsonDocument = {
        meta: { schemaVersion: 999, documentType: 'paywall' },
        nodes: {
          root: { type: 'root', id: 'root' }
        }
      };

      // Should not throw
      converter.fromJson(json, false);

      // Document should be imported
      expect(editor.hasNode('root')).toBe(true);
    });

    it('should import document and replace existing content', () => {
      // Create initial content
      editor.initialize();
      editor.createRootNode();
      editor.createNode('screen', {
        id: 'old-screen',
        parent: { id: 'root', index: 'a' }
      });

      // Create a valid JSON document by exporting from another editor
      const sourceEditor = new DocumentEditor(document);
      sourceEditor.initialize();
      sourceEditor.createRootNode();
      sourceEditor.createNode('screen', {
        id: 'new-screen',
        parent: { id: 'root', index: 'a' }
      });
      const sourceConverter = new JsonConverter(sourceEditor);
      const json = sourceConverter.toJson();

      converter.fromJson(json);

      expect(editor.hasNode('old-screen')).toBe(false);
      expect(editor.hasNode('new-screen')).toBe(true);
    });

    it('should initialize metadata after import', () => {
      const json: JsonDocument = {
        meta: { schemaVersion: 1, documentType: 'paywall' },
        nodes: {
          root: { type: 'root', id: 'root' }
        }
      };

      converter.fromJson(json);

      const meta = editor.getMeta();
      expect(meta).not.toBeNull();
      expect(meta?.schemaVersion).toBe(1);
      expect(meta?.documentType).toBe('paywall');
    });
  });

  describe('fromJsonString', () => {
    it('should parse and import JSON string', () => {
      const json: JsonDocument = {
        meta: { schemaVersion: 1, documentType: 'paywall' },
        nodes: {
          root: { type: 'root', id: 'root' }
        }
      };

      converter.fromJsonString(JSON.stringify(json));

      expect(editor.hasNode('root')).toBe(true);
    });

    it('should throw for invalid JSON', () => {
      expect(() => converter.fromJsonString('invalid json')).toThrow();
    });
  });

  describe('snapshot', () => {
    beforeEach(() => {
      editor.initialize();
      editor.createRootNode();
      editor.createNode('screen', {
        id: 'screen-1',
        parent: { id: 'root', index: 'a' }
      });
    });

    it('should create a deep clone of the document', () => {
      const snapshot = converter.snapshot();

      // Modify the original document
      editor.updateNode('screen-1', { name: 'Modified Name' });

      // Snapshot should be unchanged
      const snapshotScreen = snapshot.nodes['screen-1'] as Record<
        string,
        unknown
      >;
      expect(snapshotScreen.name).toBe('Screen');

      // But original should be modified
      const currentScreen = editor.getNode('screen-1') as Record<
        string,
        unknown
      >;
      expect(currentScreen.name).toBe('Modified Name');
    });

    it('should return valid JSON document', () => {
      const snapshot = converter.snapshot();

      expect(snapshot.meta).toEqual({
        schemaVersion: 1,
        documentType: 'paywall'
      });
      expect(snapshot.nodes).toBeDefined();
      expect(Object.keys(snapshot.nodes)).toHaveLength(2);
    });
  });

  describe('round-trip', () => {
    it('should preserve document content through export and import', () => {
      // Setup initial document
      editor.initialize();
      editor.createRootNode();
      editor.createNode('screen', {
        id: 'screen-1',
        parent: { id: 'root', index: 'a' },
        name: 'My Screen'
      });
      editor.createNode('flex', {
        id: 'flex-1',
        parent: { id: 'screen-1', index: 'a' },
        name: 'My Flex'
      });

      // Export
      const jsonString = converter.toJsonString();

      // Create new editor and converter
      const newEditor = new DocumentEditor(document);
      const newConverter = new JsonConverter(newEditor);

      // Import
      newConverter.fromJsonString(jsonString);

      // Verify content
      expect(newEditor.hasNode('root')).toBe(true);
      expect(newEditor.hasNode('screen-1')).toBe(true);
      expect(newEditor.hasNode('flex-1')).toBe(true);

      const screen = newEditor.getNode('screen-1') as Record<string, unknown>;
      expect(screen.name).toBe('My Screen');

      const flex = newEditor.getNode('flex-1') as Record<string, unknown>;
      expect(flex.name).toBe('My Flex');
    });
  });
});
