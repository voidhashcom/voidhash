import type { ParentRef } from '../core';
import { PaywallDocument } from '../documents';
import type { FlexNodeData, ScreenNodeData, TextNodeData } from '../nodes';
import { DocumentEditor, type DocumentEditorOptions } from './document-editor';

/** Data required to create a screen node (id and parent are required) */
export type CreateScreenData = { id: string; parent: ParentRef } & Partial<
  Omit<ScreenNodeData, 'id' | 'parent' | 'type'>
>;

/** Data required to create a flex node (id and parent are required) */
export type CreateFlexData = { id: string; parent: ParentRef } & Partial<
  Omit<FlexNodeData, 'id' | 'parent' | 'type'>
>;

/** Data required to create a text node (id and parent are required) */
export type CreateTextData = { id: string; parent: ParentRef } & Partial<
  Omit<TextNodeData, 'id' | 'parent' | 'type'>
>;

/**
 * Paywall-specific document editor with typed convenience methods.
 * Extends the base DocumentEditor with methods tailored for paywall documents.
 */
export class PaywallDocumentEditor extends DocumentEditor<PaywallDocument> {
  constructor(options: DocumentEditorOptions = {}) {
    super(new PaywallDocument(), options);
  }

  /**
   * Create a PaywallDocumentEditor from existing nodes.
   * Useful for creating a read-only view from Zustand state.
   *
   * @example
   * ```tsx
   * const nodes = useDesignerSelect(state => state.nodes);
   * const editor = PaywallDocumentEditor.fromNodes(nodes);
   * const screen = editor.getScreen('screen-1');
   * ```
   */
  static fromNodes(nodes: Record<string, unknown>): PaywallDocumentEditor {
    return new PaywallDocumentEditor({ initialNodes: nodes });
  }

  /**
   * Create a new screen node with typed data.
   * @returns The created screen node data
   */
  createScreen(data: CreateScreenData): ScreenNodeData {
    return this.createNode('screen', data) as unknown as ScreenNodeData;
  }

  /**
   * Create a new flex node with typed data.
   * @returns The created flex node data
   */
  createFlex(data: CreateFlexData): FlexNodeData {
    return this.createNode('flex', data) as unknown as FlexNodeData;
  }

  /**
   * Create a new text node with typed data.
   * @returns The created text node data
   */
  createText(data: CreateTextData): TextNodeData {
    return this.createNode('text', data) as unknown as TextNodeData;
  }

  /**
   * Get a screen node by ID with proper typing.
   * @throws NodeNotFoundError if node doesn't exist
   */
  getScreen(nodeId: string): ScreenNodeData {
    return this.getNode(nodeId) as ScreenNodeData;
  }

  /**
   * Get a flex node by ID with proper typing.
   * @throws NodeNotFoundError if node doesn't exist
   */
  getFlex(nodeId: string): FlexNodeData {
    return this.getNode(nodeId) as FlexNodeData;
  }

  /**
   * Get a text node by ID with proper typing.
   * @throws NodeNotFoundError if node doesn't exist
   */
  getText(nodeId: string): TextNodeData {
    return this.getNode(nodeId) as TextNodeData;
  }
}
