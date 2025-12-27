// /** biome-ignore-all lint/suspicious/noExplicitAny: test utilities use any for flexibility */
// /** biome-ignore-all lint/style/noNonNullAssertion: test assertions use non-null for clarity */

// import { beforeEach, describe, expect, it } from 'vitest';
// import type { z } from 'zod';
// import { paywallDocument } from '../documents/paywall-document';
// import { getDefaults } from '../schema';
// import { createEditor } from './create-editor';
// import { NodeNotFoundError, ValidationError } from './errors';
// import type { Editor } from './types';

// // ============================================================================
// // Test Fixtures
// // ============================================================================

// function createTestRootNode(id = 'root') {
//   return {
//     type: 'root' as const,
//     id
//   };
// }

// function createTestScreenNode(id: string, name = 'Screen', index = 'a0') {
//   const screenNodeShape = paywallDocument.nodes.screen.shape;
//   const styleSchema = screenNodeShape.style as z.ZodObject<any>;
//   const styleDefaults = getDefaults(styleSchema);

//   return {
//     type: 'screen' as const,
//     id,
//     name,
//     parent: { id: 'root', index },
//     localVariables: [],
//     linkedVariables: [],
//     states: [],
//     style: styleDefaults
//   };
// }

// function createTestFlexNode(
//   id: string,
//   parentId: string,
//   name = 'Flex',
//   index = 'a0'
// ) {
//   const flexNodeShape = paywallDocument.nodes.flex.shape;
//   const styleSchema = flexNodeShape.style as z.ZodObject<any>;
//   const styleDefaults = getDefaults(styleSchema);

//   return {
//     type: 'flex' as const,
//     id,
//     name,
//     parent: { id: parentId, index },
//     localVariables: [],
//     linkedVariables: [],
//     states: [],
//     style: styleDefaults
//   };
// }

// function createTestTextNode(
//   id: string,
//   parentId: string,
//   name = 'Text',
//   index = 'a0'
// ) {
//   const textNodeShape = paywallDocument.nodes.text.shape;
//   const styleSchema = textNodeShape.style as z.ZodObject<any>;
//   const styleDefaults = getDefaults(styleSchema);

//   return {
//     type: 'text' as const,
//     id,
//     name,
//     parent: { id: parentId, index },
//     localVariables: [],
//     linkedVariables: [],
//     states: [],
//     style: styleDefaults,
//     content: 'Hello'
//   };
// }

// // ============================================================================
// // Tree Utilities Tests
// // ============================================================================

// describe('TreeUtils', () => {
//   let editor: Editor<typeof paywallDocument>;

//   beforeEach(() => {
//     editor = createEditor(paywallDocument, {
//       initialNodes: {
//         root: createTestRootNode(),
//         'screen-1': createTestScreenNode('screen-1', 'Screen 1', 'a0'),
//         'screen-2': createTestScreenNode('screen-2', 'Screen 2', 'a1'),
//         'flex-1': createTestFlexNode('flex-1', 'screen-1', 'Flex 1', 'a0'),
//         'flex-2': createTestFlexNode('flex-2', 'screen-1', 'Flex 2', 'a1'),
//         'text-1': createTestTextNode('text-1', 'flex-1', 'Text 1', 'a0')
//       }
//     });
//   });

//   describe('getChildren', () => {
//     it('should return direct children of a node', () => {
//       const children = editor.tree.getChildren('screen-1');
//       const childIds = children.map((h) => (h.get() as any).id);

//       expect(childIds).toHaveLength(2);
//       expect(childIds).toContain('flex-1');
//       expect(childIds).toContain('flex-2');
//     });

//     it('should return empty array for leaf nodes', () => {
//       const children = editor.tree.getChildren('text-1');
//       expect(children).toHaveLength(0);
//     });
//   });

//   describe('getSortedChildren', () => {
//     it('should return children sorted by index', () => {
//       const children = editor.tree.getSortedChildren('root');
//       const childIds = children.map((h) => (h.get() as any).id);

//       expect(childIds).toEqual(['screen-1', 'screen-2']);
//     });
//   });

//   describe('getDescendants', () => {
//     it('should return all descendants of a node', () => {
//       const descendants = editor.tree.getDescendants('screen-1');
//       const descendantIds = descendants.map((h) => (h.get() as any).id);

//       expect(descendantIds).toHaveLength(3);
//       expect(descendantIds).toContain('flex-1');
//       expect(descendantIds).toContain('flex-2');
//       expect(descendantIds).toContain('text-1');
//     });

//     it('should return empty array for leaf nodes', () => {
//       const descendants = editor.tree.getDescendants('text-1');
//       expect(descendants).toHaveLength(0);
//     });
//   });

//   describe('getAncestors', () => {
//     it('should return ancestors from immediate parent to root', () => {
//       const ancestors = editor.tree.getAncestors('text-1');
//       const ancestorIds = ancestors.map((h) => (h.get() as any).id);

//       expect(ancestorIds).toEqual(['flex-1', 'screen-1', 'root']);
//     });

//     it('should return empty array for root node', () => {
//       const ancestors = editor.tree.getAncestors('root');
//       expect(ancestors).toHaveLength(0);
//     });
//   });

//   describe('isDescendantOf', () => {
//     it('should return true for direct children', () => {
//       expect(editor.tree.isDescendantOf('flex-1', 'screen-1')).toBe(true);
//     });

//     it('should return true for nested descendants', () => {
//       expect(editor.tree.isDescendantOf('text-1', 'screen-1')).toBe(true);
//     });

//     it('should return false for siblings', () => {
//       expect(editor.tree.isDescendantOf('flex-1', 'flex-2')).toBe(false);
//     });

//     it('should return false for same node', () => {
//       expect(editor.tree.isDescendantOf('flex-1', 'flex-1')).toBe(false);
//     });

//     it('should return false for parent', () => {
//       expect(editor.tree.isDescendantOf('screen-1', 'flex-1')).toBe(false);
//     });
//   });

//   describe('getParent', () => {
//     it('should return parent handle', () => {
//       const parent = editor.tree.getParent('flex-1');
//       expect(parent).toBeDefined();
//       expect((parent?.get() as any).id).toBe('screen-1');
//     });

//     it('should return undefined for root node', () => {
//       const parent = editor.tree.getParent('root');
//       expect(parent).toBeUndefined();
//     });
//   });
// });

// // ============================================================================
// // Commands Tests
// // ============================================================================

// describe('EditorCommands', () => {
//   let editor: Editor<typeof paywallDocument>;

//   beforeEach(() => {
//     editor = createEditor(paywallDocument, {
//       initialNodes: {
//         root: createTestRootNode(),
//         'screen-1': createTestScreenNode('screen-1', 'Screen 1', 'a0')
//       }
//     });
//   });

//   describe('createNode', () => {
//     it('should create a node with auto-generated ID', () => {
//       const handle = editor.commands.createNode('flex', {
//         parentId: 'screen-1'
//       });

//       const node = handle.get() as any;
//       expect(node.type).toBe('flex');
//       expect(node.id).toBeDefined();
//       expect(node.parent.id).toBe('screen-1');
//     });

//     it('should create a node with custom ID', () => {
//       const handle = editor.commands.createNode('flex', {
//         id: 'custom-flex-1',
//         parentId: 'screen-1'
//       });

//       const node = handle.get() as any;
//       expect(node.id).toBe('custom-flex-1');
//     });

//     it('should create node at end by default', () => {
//       // Create two nodes
//       editor.commands.createNode('flex', {
//         id: 'flex-1',
//         parentId: 'screen-1'
//       });
//       editor.commands.createNode('flex', {
//         id: 'flex-2',
//         parentId: 'screen-1'
//       });

//       const children = editor.tree.getSortedChildren('screen-1');
//       const childIds = children.map((h) => (h.get() as any).id);

//       expect(childIds).toEqual(['flex-1', 'flex-2']);
//     });

//     it('should create node before specified sibling', () => {
//       editor.commands.createNode('flex', {
//         id: 'flex-1',
//         parentId: 'screen-1'
//       });
//       editor.commands.createNode('flex', {
//         id: 'flex-2',
//         parentId: 'screen-1'
//       });
//       editor.commands.createNode('flex', {
//         id: 'flex-3',
//         parentId: 'screen-1',
//         beforeSiblingId: 'flex-2'
//       });

//       const children = editor.tree.getSortedChildren('screen-1');
//       const childIds = children.map((h) => (h.get() as any).id);

//       expect(childIds).toEqual(['flex-1', 'flex-3', 'flex-2']);
//     });

//     it('should throw NodeNotFoundError for non-existent parent', () => {
//       expect(() => {
//         editor.commands.createNode('flex', {
//           parentId: 'non-existent'
//         });
//       }).toThrow(NodeNotFoundError);
//     });

//     it('should merge custom data with defaults', () => {
//       const handle = editor.commands.createNode('flex', {
//         parentId: 'screen-1',
//         data: { name: 'Custom Flex' }
//       });

//       const node = handle.get() as any;
//       expect(node.name).toBe('Custom Flex');
//       expect(node.style).toBeDefined(); // Defaults should be applied
//     });
//   });

//   describe('deleteSubtree', () => {
//     it('should delete a single node', () => {
//       editor.commands.createNode('flex', {
//         id: 'flex-1',
//         parentId: 'screen-1'
//       });

//       editor.commands.deleteSubtree('flex-1');

//       expect(editor.nodes.get('flex-1')).toBeUndefined();
//     });

//     it('should delete node and all descendants', () => {
//       editor.commands.createNode('flex', {
//         id: 'flex-1',
//         parentId: 'screen-1'
//       });
//       editor.commands.createNode('text', { id: 'text-1', parentId: 'flex-1' });
//       editor.commands.createNode('flex', { id: 'flex-2', parentId: 'flex-1' });
//       editor.commands.createNode('text', { id: 'text-2', parentId: 'flex-2' });

//       editor.commands.deleteSubtree('flex-1');

//       expect(editor.nodes.get('flex-1')).toBeUndefined();
//       expect(editor.nodes.get('text-1')).toBeUndefined();
//       expect(editor.nodes.get('flex-2')).toBeUndefined();
//       expect(editor.nodes.get('text-2')).toBeUndefined();
//     });

//     it('should throw NodeNotFoundError for non-existent node', () => {
//       expect(() => {
//         editor.commands.deleteSubtree('non-existent');
//       }).toThrow(NodeNotFoundError);
//     });
//   });

//   describe('moveNode', () => {
//     beforeEach(() => {
//       // Set up a more complex tree
//       editor = createEditor(paywallDocument, {
//         initialNodes: {
//           root: createTestRootNode(),
//           'screen-1': createTestScreenNode('screen-1', 'Screen 1', 'a0'),
//           'screen-2': createTestScreenNode('screen-2', 'Screen 2', 'a1'),
//           'flex-1': createTestFlexNode('flex-1', 'screen-1', 'Flex 1', 'a0'),
//           'flex-2': createTestFlexNode('flex-2', 'screen-1', 'Flex 2', 'a1'),
//           'text-1': createTestTextNode('text-1', 'flex-1', 'Text 1', 'a0')
//         }
//       });
//     });

//     it('should move node to different parent', () => {
//       editor.commands.moveNode('flex-1', { parentId: 'screen-2' });

//       const node = editor.nodes.get('flex-1')?.get() as any;
//       expect(node.parent.id).toBe('screen-2');
//     });

//     it('should move node before specified sibling', () => {
//       editor.commands.moveNode('flex-2', {
//         parentId: 'screen-1',
//         beforeSiblingId: 'flex-1'
//       });

//       const children = editor.tree.getSortedChildren('screen-1');
//       const childIds = children.map((h) => (h.get() as any).id);

//       expect(childIds).toEqual(['flex-2', 'flex-1']);
//     });

//     it('should throw ValidationError when moving node into itself', () => {
//       expect(() => {
//         editor.commands.moveNode('flex-1', { parentId: 'flex-1' });
//       }).toThrow(ValidationError);
//     });

//     it('should throw ValidationError when moving node into its descendant', () => {
//       expect(() => {
//         editor.commands.moveNode('flex-1', { parentId: 'text-1' });
//       }).toThrow(ValidationError);
//     });

//     it('should throw NodeNotFoundError for non-existent node', () => {
//       expect(() => {
//         editor.commands.moveNode('non-existent', { parentId: 'screen-1' });
//       }).toThrow(NodeNotFoundError);
//     });

//     it('should throw NodeNotFoundError for non-existent parent', () => {
//       expect(() => {
//         editor.commands.moveNode('flex-1', { parentId: 'non-existent' });
//       }).toThrow(NodeNotFoundError);
//     });
//   });

//   describe('addVariable', () => {
//     it('should add a variable to a node', () => {
//       const variableId = editor.commands.addVariable(
//         'screen-1',
//         'string',
//         'myVariable'
//       );

//       expect(variableId).toBeDefined();
//       const node = editor.nodes.get('screen-1')?.get() as any;
//       expect(node.localVariables).toHaveLength(1);
//       expect(node.localVariables[0]?.name).toBe('myVariable');
//       expect(node.localVariables[0]?.id).toBe(variableId);
//     });

//     it('should return the created variable ID', () => {
//       const variableId = editor.commands.addVariable(
//         'screen-1',
//         'number',
//         'count'
//       );

//       const node = editor.nodes.get('screen-1')?.get() as any;
//       const variable = node.localVariables.find((v: any) => v.name === 'count');
//       expect(variable?.id).toBe(variableId);
//     });

//     it('should throw ValidationError if variable name already exists', () => {
//       editor.commands.addVariable('screen-1', 'string', 'myVariable');

//       expect(() => {
//         editor.commands.addVariable('screen-1', 'number', 'myVariable');
//       }).toThrow(ValidationError);
//     });

//     it('should throw NodeNotFoundError for non-existent node', () => {
//       expect(() => {
//         editor.commands.addVariable('non-existent', 'string', 'myVariable');
//       }).toThrow(NodeNotFoundError);
//     });

//     it('should create variables with correct default values', () => {
//       editor.commands.addVariable('screen-1', 'string', 'strVar');
//       editor.commands.addVariable('screen-1', 'number', 'numVar');
//       editor.commands.addVariable('screen-1', 'boolean', 'boolVar');

//       const node = editor.nodes.get('screen-1')?.get() as any;
//       expect(node.localVariables).toHaveLength(3);

//       const strVar = node.localVariables.find((v: any) => v.name === 'strVar');
//       expect(strVar?.value.key).toBe('string');
//       expect(strVar?.value.value).toBe('');

//       const numVar = node.localVariables.find((v: any) => v.name === 'numVar');
//       expect(numVar?.value.key).toBe('number');
//       expect(numVar?.value.value).toBe(0);

//       const boolVar = node.localVariables.find(
//         (v: any) => v.name === 'boolVar'
//       );
//       expect(boolVar?.value.key).toBe('boolean');
//       expect(boolVar?.value.value).toBe(false);
//     });
//   });

//   describe('removeVariable', () => {
//     it('should remove a variable by ID', () => {
//       const variableId = editor.commands.addVariable(
//         'screen-1',
//         'string',
//         'myVariable'
//       );

//       editor.commands.removeVariable('screen-1', variableId);

//       const node = editor.nodes.get('screen-1')?.get() as any;
//       expect(node.localVariables).toHaveLength(0);
//     });

//     it('should remove the correct variable when multiple exist', () => {
//       const var1Id = editor.commands.addVariable('screen-1', 'string', 'var1');
//       const var2Id = editor.commands.addVariable('screen-1', 'number', 'var2');

//       editor.commands.removeVariable('screen-1', var1Id);

//       const node = editor.nodes.get('screen-1')?.get() as any;
//       expect(node.localVariables).toHaveLength(1);
//       expect(node.localVariables[0]?.name).toBe('var2');
//       expect(node.localVariables[0]?.id).toBe(var2Id);
//     });

//     it('should throw ValidationError if variable ID does not exist', () => {
//       expect(() => {
//         editor.commands.removeVariable('screen-1', 'non-existent-id');
//       }).toThrow(ValidationError);
//     });

//     it('should throw NodeNotFoundError for non-existent node', () => {
//       expect(() => {
//         editor.commands.removeVariable('non-existent', 'some-id');
//       }).toThrow(NodeNotFoundError);
//     });
//   });

//   describe('updateVariable', () => {
//     it('should update variable name', () => {
//       const variableId = editor.commands.addVariable(
//         'screen-1',
//         'string',
//         'oldName'
//       );

//       editor.commands.updateVariable('screen-1', variableId, {
//         newName: 'newName'
//       });

//       const node = editor.nodes.get('screen-1')?.get() as any;
//       const variable = node.localVariables.find(
//         (v: any) => v.id === variableId
//       );
//       expect(variable?.name).toBe('newName');
//       expect(variable?.id).toBe(variableId); // ID should remain the same
//     });

//     it('should update variable value', () => {
//       const variableId = editor.commands.addVariable(
//         'screen-1',
//         'string',
//         'myVar'
//       );

//       editor.commands.updateVariable('screen-1', variableId, {
//         newValue: { key: 'string', value: 'new value' }
//       });

//       const node = editor.nodes.get('screen-1')?.get() as any;
//       const variable = node.localVariables.find(
//         (v: any) => v.id === variableId
//       );
//       expect(variable?.value.value).toBe('new value');
//     });

//     it('should update both name and value', () => {
//       const variableId = editor.commands.addVariable(
//         'screen-1',
//         'number',
//         'oldName'
//       );

//       editor.commands.updateVariable('screen-1', variableId, {
//         newName: 'newName',
//         newValue: { key: 'number', value: 42 }
//       });

//       const node = editor.nodes.get('screen-1')?.get() as any;
//       const variable = node.localVariables.find(
//         (v: any) => v.id === variableId
//       );
//       expect(variable?.name).toBe('newName');
//       expect(variable?.value.value).toBe(42);
//     });

//     it('should throw ValidationError if variable ID does not exist', () => {
//       expect(() => {
//         editor.commands.updateVariable('screen-1', 'non-existent-id', {
//           newName: 'newName'
//         });
//       }).toThrow(ValidationError);
//     });

//     it('should throw ValidationError if new name conflicts with existing variable', () => {
//       const var1Id = editor.commands.addVariable('screen-1', 'string', 'var1');
//       editor.commands.addVariable('screen-1', 'string', 'var2');

//       expect(() => {
//         editor.commands.updateVariable('screen-1', var1Id, {
//           newName: 'var2'
//         });
//       }).toThrow(ValidationError);
//     });

//     it('should allow updating name to same name', () => {
//       const variableId = editor.commands.addVariable(
//         'screen-1',
//         'string',
//         'myVar'
//       );

//       editor.commands.updateVariable('screen-1', variableId, {
//         newName: 'myVar'
//       });

//       const node = editor.nodes.get('screen-1')?.get() as any;
//       const variable = node.localVariables.find(
//         (v: any) => v.id === variableId
//       );
//       expect(variable?.name).toBe('myVar');
//     });

//     it('should throw NodeNotFoundError for non-existent node', () => {
//       expect(() => {
//         editor.commands.updateVariable('non-existent', 'some-id', {
//           newName: 'newName'
//         });
//       }).toThrow(NodeNotFoundError);
//     });
//   });

//   describe('addState', () => {
//     const defaultCondition = {
//       type: 'or' as const,
//       value: [
//         {
//           type: 'and' as const,
//           value: [
//             {
//               type: 'equals' as const,
//               value: {
//                 left: {
//                   type: 'literal' as const,
//                   value: { key: 'boolean' as const, value: true }
//                 },
//                 right: {
//                   type: 'literal' as const,
//                   value: { key: 'boolean' as const, value: true }
//                 }
//               }
//             }
//           ]
//         }
//       ]
//     };

//     it('should add a state to a node', () => {
//       const stateId = editor.commands.addState(
//         'screen-1',
//         'myState',
//         defaultCondition
//       );

//       expect(stateId).toBeDefined();
//       const node = editor.nodes.get('screen-1')?.get() as any;
//       expect(node.states).toHaveLength(1);
//       expect(node.states[0]?.name).toBe('myState');
//       expect(node.states[0]?.id).toBe(stateId);
//     });

//     it('should return the created state ID', () => {
//       const stateId = editor.commands.addState(
//         'screen-1',
//         'count',
//         defaultCondition
//       );

//       const node = editor.nodes.get('screen-1')?.get() as any;
//       const state = node.states.find((s: any) => s.name === 'count');
//       expect(state?.id).toBe(stateId);
//     });

//     it('should throw ValidationError if state name already exists', () => {
//       editor.commands.addState('screen-1', 'myState', defaultCondition);

//       expect(() => {
//         editor.commands.addState('screen-1', 'myState', defaultCondition);
//       }).toThrow(ValidationError);
//     });

//     it('should throw NodeNotFoundError for non-existent node', () => {
//       expect(() => {
//         editor.commands.addState('non-existent', 'myState', defaultCondition);
//       }).toThrow(NodeNotFoundError);
//     });

//     it('should create state with provided DNF condition', () => {
//       const customCondition = {
//         type: 'or' as const,
//         value: [
//           {
//             type: 'and' as const,
//             value: [
//               {
//                 type: 'equals' as const,
//                 value: {
//                   left: {
//                     type: 'literal' as const,
//                     value: { key: 'string' as const, value: 'test' }
//                   },
//                   right: {
//                     type: 'literal' as const,
//                     value: { key: 'string' as const, value: 'test' }
//                   }
//                 }
//               }
//             ]
//           }
//         ]
//       };

//       editor.commands.addState('screen-1', 'customState', customCondition);

//       const node = editor.nodes.get('screen-1')?.get() as any;
//       const state = node.states.find((s: any) => s.name === 'customState');
//       expect(state?.condition).toEqual(customCondition);
//     });
//   });

//   describe('removeState', () => {
//     const defaultCondition = {
//       type: 'or' as const,
//       value: [
//         {
//           type: 'and' as const,
//           value: [
//             {
//               type: 'equals' as const,
//               value: {
//                 left: {
//                   type: 'literal' as const,
//                   value: { key: 'boolean' as const, value: true }
//                 },
//                 right: {
//                   type: 'literal' as const,
//                   value: { key: 'boolean' as const, value: true }
//                 }
//               }
//             }
//           ]
//         }
//       ]
//     };

//     it('should remove a state by ID', () => {
//       const stateId = editor.commands.addState(
//         'screen-1',
//         'myState',
//         defaultCondition
//       );

//       editor.commands.removeState('screen-1', stateId);

//       const node = editor.nodes.get('screen-1')?.get() as any;
//       expect(node.states).toHaveLength(0);
//     });

//     it('should remove the correct state when multiple exist', () => {
//       const state1Id = editor.commands.addState(
//         'screen-1',
//         'state1',
//         defaultCondition
//       );
//       const state2Id = editor.commands.addState(
//         'screen-1',
//         'state2',
//         defaultCondition
//       );

//       editor.commands.removeState('screen-1', state1Id);

//       const node = editor.nodes.get('screen-1')?.get() as any;
//       expect(node.states).toHaveLength(1);
//       expect(node.states[0]?.name).toBe('state2');
//       expect(node.states[0]?.id).toBe(state2Id);
//     });

//     it('should throw ValidationError if state ID does not exist', () => {
//       expect(() => {
//         editor.commands.removeState('screen-1', 'non-existent-id');
//       }).toThrow(ValidationError);
//     });

//     it('should throw NodeNotFoundError for non-existent node', () => {
//       expect(() => {
//         editor.commands.removeState('non-existent', 'some-id');
//       }).toThrow(NodeNotFoundError);
//     });
//   });

//   describe('updateState', () => {
//     const defaultCondition = {
//       type: 'or' as const,
//       value: [
//         {
//           type: 'and' as const,
//           value: [
//             {
//               type: 'equals' as const,
//               value: {
//                 left: {
//                   type: 'literal' as const,
//                   value: { key: 'boolean' as const, value: true }
//                 },
//                 right: {
//                   type: 'literal' as const,
//                   value: { key: 'boolean' as const, value: true }
//                 }
//               }
//             }
//           ]
//         }
//       ]
//     };

//     it('should update state name', () => {
//       const stateId = editor.commands.addState(
//         'screen-1',
//         'oldName',
//         defaultCondition
//       );

//       editor.commands.updateState('screen-1', stateId, {
//         newName: 'newName'
//       });

//       const node = editor.nodes.get('screen-1')?.get() as any;
//       const state = node.states.find((s: any) => s.id === stateId);
//       expect(state?.name).toBe('newName');
//       expect(state?.id).toBe(stateId); // ID should remain the same
//     });

//     it('should update state condition', () => {
//       const stateId = editor.commands.addState(
//         'screen-1',
//         'myState',
//         defaultCondition
//       );

//       const newCondition = {
//         type: 'or' as const,
//         value: [
//           {
//             type: 'and' as const,
//             value: [
//               {
//                 type: 'equals' as const,
//                 value: {
//                   left: {
//                     type: 'literal' as const,
//                     value: { key: 'string' as const, value: 'new' }
//                   },
//                   right: {
//                     type: 'literal' as const,
//                     value: { key: 'string' as const, value: 'new' }
//                   }
//                 }
//               }
//             ]
//           }
//         ]
//       };

//       editor.commands.updateState('screen-1', stateId, {
//         newCondition
//       });

//       const node = editor.nodes.get('screen-1')?.get() as any;
//       const state = node.states.find((s: any) => s.id === stateId);
//       expect(state?.condition).toEqual(newCondition);
//     });

//     it('should update both name and condition', () => {
//       const stateId = editor.commands.addState(
//         'screen-1',
//         'oldName',
//         defaultCondition
//       );

//       const newCondition = {
//         type: 'or' as const,
//         value: [
//           {
//             type: 'and' as const,
//             value: [
//               {
//                 type: 'equals' as const,
//                 value: {
//                   left: {
//                     type: 'literal' as const,
//                     value: { key: 'number' as const, value: 42 }
//                   },
//                   right: {
//                     type: 'literal' as const,
//                     value: { key: 'number' as const, value: 42 }
//                   }
//                 }
//               }
//             ]
//           }
//         ]
//       };

//       editor.commands.updateState('screen-1', stateId, {
//         newName: 'newName',
//         newCondition
//       });

//       const node = editor.nodes.get('screen-1')?.get() as any;
//       const state = node.states.find((s: any) => s.id === stateId);
//       expect(state?.name).toBe('newName');
//       expect(state?.condition).toEqual(newCondition);
//     });

//     it('should throw ValidationError if state ID does not exist', () => {
//       expect(() => {
//         editor.commands.updateState('screen-1', 'non-existent-id', {
//           newName: 'newName'
//         });
//       }).toThrow(ValidationError);
//     });

//     it('should throw ValidationError if new name conflicts with existing state', () => {
//       const state1Id = editor.commands.addState(
//         'screen-1',
//         'state1',
//         defaultCondition
//       );
//       editor.commands.addState('screen-1', 'state2', defaultCondition);

//       expect(() => {
//         editor.commands.updateState('screen-1', state1Id, {
//           newName: 'state2'
//         });
//       }).toThrow(ValidationError);
//     });

//     it('should allow updating name to same name', () => {
//       const stateId = editor.commands.addState(
//         'screen-1',
//         'myState',
//         defaultCondition
//       );

//       editor.commands.updateState('screen-1', stateId, {
//         newName: 'myState'
//       });

//       const node = editor.nodes.get('screen-1')?.get() as any;
//       const state = node.states.find((s: any) => s.id === stateId);
//       expect(state?.name).toBe('myState');
//     });

//     it('should throw NodeNotFoundError for non-existent node', () => {
//       expect(() => {
//         editor.commands.updateState('non-existent', 'some-id', {
//           newName: 'newName'
//         });
//       }).toThrow(NodeNotFoundError);
//     });
//   });
// });

// // ============================================================================
// // Serialization Tests
// // ============================================================================

// describe('SerializationUtils', () => {
//   let editor: Editor<typeof paywallDocument>;

//   beforeEach(() => {
//     editor = createEditor(paywallDocument, {
//       initialNodes: {
//         root: createTestRootNode(),
//         'screen-1': createTestScreenNode('screen-1', 'Screen 1', 'a0'),
//         'flex-1': createTestFlexNode('flex-1', 'screen-1', 'Flex 1', 'a0'),
//         'flex-2': createTestFlexNode('flex-2', 'screen-1', 'Flex 2', 'a1'),
//         'text-1': createTestTextNode('text-1', 'flex-1', 'Text 1', 'a0'),
//         'text-2': createTestTextNode('text-2', 'flex-1', 'Text 2', 'a1')
//       }
//     });
//   });

//   describe('serializeNodes', () => {
//     it('should serialize a single node', () => {
//       const serialized = editor.serialization.serializeNodes(['text-1']);

//       expect(serialized.nodes).toHaveLength(1);
//       expect(serialized.rootNodeIds).toEqual(['text-1']);
//       expect((serialized.nodes[0] as any).id).toBe('text-1');
//     });

//     it('should serialize node with descendants', () => {
//       const serialized = editor.serialization.serializeNodes(['flex-1']);

//       expect(serialized.nodes).toHaveLength(3); // flex-1, text-1, text-2
//       expect(serialized.rootNodeIds).toEqual(['flex-1']);
//       expect(serialized.originalParentId).toBe('screen-1');
//     });

//     it('should skip root nodes', () => {
//       const serialized = editor.serialization.serializeNodes(['root']);

//       expect(serialized.nodes).toHaveLength(0);
//       expect(serialized.rootNodeIds).toHaveLength(0);
//     });

//     it('should serialize multiple nodes', () => {
//       const serialized = editor.serialization.serializeNodes([
//         'flex-1',
//         'flex-2'
//       ]);

//       // flex-1 + text-1 + text-2 + flex-2
//       expect(serialized.nodes).toHaveLength(4);
//       expect(serialized.rootNodeIds).toEqual(['flex-1', 'flex-2']);
//     });
//   });

//   describe('deserializeNodes', () => {
//     it('should deserialize with new IDs', () => {
//       const serialized = editor.serialization.serializeNodes(['text-1']);
//       const newIds = editor.serialization.deserializeNodes(serialized, {
//         parentId: 'flex-2'
//       });

//       expect(newIds).toHaveLength(1);
//       expect(newIds[0]).not.toBe('text-1'); // New ID generated

//       const newRootNodeId = newIds[0];
//       if (!newRootNodeId) {
//         throw new Error('No new root node id even though there should be one');
//       }
//       const newNode = editor.nodes.get(newRootNodeId)?.get() as any;
//       expect(newNode.type).toBe('text');
//       expect(newNode.parent.id).toBe('flex-2');
//     });

//     it('should preserve hierarchy when deserializing', () => {
//       const serialized = editor.serialization.serializeNodes(['flex-1']);
//       const newIds = editor.serialization.deserializeNodes(serialized, {
//         parentId: 'flex-2'
//       });

//       expect(newIds).toHaveLength(1);

//       // Check that children were also created
//       const newRootNodeId = newIds[0];
//       if (!newRootNodeId) {
//         throw new Error('No new root node id even though there should be one');
//       }
//       const newFlex = editor.nodes.get(newRootNodeId)?.get() as any;
//       expect(newFlex.type).toBe('flex');

//       const children = editor.tree.getChildren(newRootNodeId);
//       expect(children).toHaveLength(2); // text-1 and text-2 were also deserialized
//     });

//     it('should throw NodeNotFoundError for non-existent parent', () => {
//       const serialized = editor.serialization.serializeNodes(['text-1']);

//       expect(() => {
//         editor.serialization.deserializeNodes(serialized, {
//           parentId: 'non-existent'
//         });
//       }).toThrow(NodeNotFoundError);
//     });

//     it('should return empty array for empty data', () => {
//       const newIds = editor.serialization.deserializeNodes(
//         { nodes: [], rootNodeIds: [], originalParentId: null },
//         { parentId: 'flex-2' }
//       );

//       expect(newIds).toEqual([]);
//     });

//     it('should preserve visual order when serializing nodes selected in reverse order', () => {
//       // Serialize nodes in reverse selection order (flex-2 before flex-1)
//       const serialized = editor.serialization.serializeNodes([
//         'flex-2',
//         'flex-1'
//       ]);

//       // Root node IDs should be in visual order (by fractional index), not selection order
//       expect(serialized.rootNodeIds).toEqual(['flex-1', 'flex-2']);
//     });

//     it('should preserve order when deserializing multiple nodes', () => {
//       // Serialize both flex nodes
//       const serialized = editor.serialization.serializeNodes([
//         'flex-1',
//         'flex-2'
//       ]);

//       // Deserialize to a new parent
//       const newIds = editor.serialization.deserializeNodes(serialized, {
//         parentId: 'screen-1'
//       });

//       expect(newIds).toHaveLength(2);

//       // Get the newly created nodes and verify they're in the correct order
//       const children = editor.tree.getSortedChildren('screen-1');
//       const childIds = children.map((h) => (h.get() as any).id);

//       // Original flex-1 and flex-2 should come before the pasted nodes
//       // Pasted nodes should maintain the same relative order as originals
//       const pastedNodeIndex0 = childIds.indexOf(newIds[0]!);
//       const pastedNodeIndex1 = childIds.indexOf(newIds[1]!);

//       expect(pastedNodeIndex0).toBeLessThan(pastedNodeIndex1);
//     });

//     it('should regenerate variable IDs when copying and pasting nodes', () => {
//       // Add variables to a node
//       const var1Id = editor.commands.addVariable('flex-1', 'string', 'var1');
//       const var2Id = editor.commands.addVariable('flex-1', 'number', 'var2');

//       // Serialize the node with variables
//       const serialized = editor.serialization.serializeNodes(['flex-1']);

//       // Verify original variable IDs are in serialized data
//       const serializedFlex = serialized.nodes.find(
//         (n) => (n as any).id === 'flex-1'
//       ) as any;
//       expect(serializedFlex?.localVariables).toHaveLength(2);
//       const serializedVarIds = serializedFlex.localVariables.map(
//         (v: any) => v.id
//       );
//       expect(serializedVarIds).toContain(var1Id);
//       expect(serializedVarIds).toContain(var2Id);

//       // Deserialize to create new nodes
//       const newIds = editor.serialization.deserializeNodes(serialized, {
//         parentId: 'screen-1'
//       });

//       expect(newIds).toHaveLength(1);
//       const newFlexId = newIds[0];
//       if (!newFlexId) {
//         throw new Error('No new flex node id even though there should be one');
//       }

//       // Verify new node has variables with new IDs
//       const newFlex = editor.nodes.get(newFlexId)?.get() as any;
//       expect(newFlex.localVariables).toHaveLength(2);
//       expect(newFlex.localVariables[0]?.name).toBe('var1');
//       expect(newFlex.localVariables[1]?.name).toBe('var2');

//       // Verify variable IDs are different from originals
//       const newVarIds = newFlex.localVariables.map((v: any) => v.id);
//       expect(newVarIds).not.toContain(var1Id);
//       expect(newVarIds).not.toContain(var2Id);
//       expect(newVarIds[0]).not.toBe(newVarIds[1]); // IDs should be unique

//       // Verify original node still has original variable IDs
//       const originalFlex = editor.nodes.get('flex-1')?.get() as any;
//       const originalVarIds = originalFlex.localVariables.map((v: any) => v.id);
//       expect(originalVarIds).toContain(var1Id);
//       expect(originalVarIds).toContain(var2Id);
//     });
//   });
// });
