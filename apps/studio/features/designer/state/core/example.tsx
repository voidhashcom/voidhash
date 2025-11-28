import * as Y from 'yjs';
import { Awareness } from 'y-protocols/awareness';
import { z } from 'zod';
import {
  createVoidsyncSchema,
  createVoidsyncState,
  createVoidsyncStore,
  syncArray,
  syncMap,
  syncText,
  useVoidsyncActions,
  useVoidsyncAwareness,
  useVoidsyncSelect
} from './voidsync';

// 1. Define the schema with 3 state categories
//    Use syncMap/syncArray/syncText to mark how fields are synced
const schema = createVoidsyncSchema({
  // Ephemeral state shared via awareness protocol (cursors, selections, presence)
  awareness: z.object({
    cursor: z
      .object({
        x: z.number(),
        y: z.number()
      })
      .nullable(),
    user: z.object({
      name: z.string(),
      color: z.string()
    })
  }),
  // Local browser state, not synced (UI preferences, panel sizes)
  browser: z.object({
    panels: z.object({
      left: z.object({
        width: z.number(),
        collapsed: z.boolean()
      }),
      right: z.object({
        width: z.number(),
        collapsed: z.boolean()
      })
    }),
    selectedNodeId: z.string().nullable()
  }),
  // Persisted state synced to the document
  // Each key here maps to a sync type based on the marker:
  synced: {
    // syncMap() → backed by Y.Map, synced as Record<string, T>
    nodes: syncMap(
      z.object({
        x: z.number(),
        y: z.number(),
        width: z.number(),
        height: z.number()
      })
    ),
    // syncArray() → backed by Y.Array, synced as T[]
    layers: syncArray(z.string()),
    // syncText() → backed by Y.Text, synced as string (for rich text binding)
    documentTitle: syncText()
  }
});

// 2. Create the document (source of truth)
const doc = new Y.Doc();
const awareness = new Awareness(doc);

// 3. Create the store state - sync is now AUTO-GENERATED from schema!
//    No need to manually write the sync function anymore.
const designerStoreState = createVoidsyncState(schema)(
  {
    awareness: {
      cursor: null,
      user: {
        name: `User ${Math.floor(Math.random() * 1000)}`,
        color: `#${Math.floor(Math.random() * 16777215).toString(16)}`
      }
    },
    browser: {
      panels: {
        left: { width: 240, collapsed: false },
        right: { width: 280, collapsed: false }
      },
      selectedNodeId: null
    }
  },
  doc,
  awareness
);

// 4. Define actions using zustand-style API: (paramsSchema, callback)
const addNodeAction = designerStoreState.action(
  z.object({
    x: z.number(),
    y: z.number(),
    width: z.number(),
    height: z.number()
  }),
  ({ doc, setBrowser, params }) => {
    const id = crypto.randomUUID();

    // Modify document (persisted, synced to all users)
    const nodesMap = doc.getMap('nodes');
    nodesMap.set(id, {
      x: params.x,
      y: params.y,
      width: params.width,
      height: params.height
    });

    // Auto-select the new node (browser state, local only)
    setBrowser({ selectedNodeId: id });
  }
);

const selectNodeAction = designerStoreState.action(
  z.object({ id: z.string().nullable() }),
  ({ setBrowser, params }) => {
    // Only affects local browser state
    setBrowser({ selectedNodeId: params.id });
  }
);

const moveNodeAction = designerStoreState.action(
  z.object({
    id: z.string(),
    x: z.number(),
    y: z.number()
  }),
  ({ doc, getState, params }) => {
    // Read current state
    const currentNode = getState().nodes?.[params.id];
    if (!currentNode) return;

    // Modify document (persisted)
    const nodesMap = doc.getMap('nodes');
    nodesMap.set(params.id, {
      ...currentNode,
      x: params.x,
      y: params.y
    });
  }
);

const deleteNodeAction = designerStoreState.action(
  z.object({ id: z.string() }),
  ({ doc, getState, setBrowser, params }) => {
    // Clear selection if deleting the selected node
    if (getState().selectedNodeId === params.id) {
      setBrowser({ selectedNodeId: null });
    }

    // Modify document (persisted)
    const nodesMap = doc.getMap('nodes');
    nodesMap.delete(params.id);
  }
);

const updateCursorAction = designerStoreState.action(
  z.object({ x: z.number(), y: z.number() }).nullable(),
  ({ setAwareness, params }) => {
    // Update awareness (ephemeral, shared with all users)
    setAwareness({ cursor: params });
  }
);

const togglePanelAction = designerStoreState.action(
  z.object({ panel: z.enum(['left', 'right']) }),
  ({ getState, setBrowser, params }) => {
    const currentPanels = getState().panels;
    const targetPanel = currentPanels[params.panel];

    // Toggle collapsed state (browser only, local)
    setBrowser({
      panels: {
        ...currentPanels,
        [params.panel]: {
          ...targetPanel,
          collapsed: !targetPanel.collapsed
        }
      }
    });
  }
);

const addLayerAction = designerStoreState.action(
  z.object({ name: z.string() }),
  ({ doc, params }) => {
    // Modify Y.Array (persisted)
    const layersArray = doc.getArray<string>('layers');
    layersArray.push([params.name]);
  }
);

const updateTitleAction = designerStoreState.action(
  z.object({ title: z.string() }),
  ({ doc, params }) => {
    // Modify Y.Text (persisted, supports rich text bindings)
    const titleText = doc.getText('documentTitle');
    titleText.delete(0, titleText.length);
    titleText.insert(0, params.title);
  }
);

// Action without params - just pass the callback directly
const resetSelectionAction = designerStoreState.action(({ setBrowser }) => {
  setBrowser({ selectedNodeId: null });
});

// 5. Combine state + actions into final store
const designerStore = createVoidsyncStore(designerStoreState, {
  addNode: addNodeAction,
  selectNode: selectNodeAction,
  moveNode: moveNodeAction,
  deleteNode: deleteNodeAction,
  updateCursor: updateCursorAction,
  togglePanel: togglePanelAction,
  addLayer: addLayerAction,
  updateTitle: updateTitleAction,
  resetSelection: resetSelectionAction
});

export function Example() {
  // Read state reactively from zustand (which is synced from the document)
  const nodes = useVoidsyncSelect(designerStore, (state) => state.nodes);
  const layers = useVoidsyncSelect(designerStore, (state) => state.layers);
  const documentTitle = useVoidsyncSelect(
    designerStore,
    (state) => state.documentTitle
  );
  const selectedNodeId = useVoidsyncSelect(
    designerStore,
    (state) => state.selectedNodeId
  );
  const leftPanel = useVoidsyncSelect(
    designerStore,
    (state) => state.panels.left
  );
  const cursor = useVoidsyncSelect(designerStore, (state) => state.cursor);
  const user = useVoidsyncSelect(designerStore, (state) => state.user);

  // Get ALL users' awareness states (for rendering remote cursors, presence, etc.)
  const awarenessStates = useVoidsyncAwareness(designerStore);

  // Filter to get other users (excluding self)
  const otherUsers = Array.from(awarenessStates.entries()).filter(
    ([clientId]) => clientId !== designerStore.clientId
  );

  // Get dispatch function for actions
  const dispatch = useVoidsyncActions(designerStore);

  const handleAddNode = () => {
    dispatch('addNode', {
      x: Math.random() * 500,
      y: Math.random() * 500,
      width: 100,
      height: 100
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    dispatch('updateCursor', { x: e.clientX, y: e.clientY });
  };

  const handleMouseLeave = () => {
    dispatch('updateCursor', null);
  };

  return (
    <div onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave}>
      {/* Current user info */}
      <div style={{ marginBottom: 16 }}>
        <span
          style={{
            display: 'inline-block',
            width: 12,
            height: 12,
            borderRadius: '50%',
            backgroundColor: user.color,
            marginRight: 8
          }}
        />
        <strong>{user.name}</strong> (You - ID: {designerStore.clientId})
        {cursor && (
          <span style={{ marginLeft: 16, color: '#666' }}>
            Cursor: ({cursor.x}, {cursor.y})
          </span>
        )}
      </div>

      {/* Other users' presence */}
      {otherUsers.length > 0 && (
        <div
          style={{
            marginBottom: 16,
            padding: 12,
            backgroundColor: '#f5f5f5',
            borderRadius: 8
          }}
        >
          <strong>Other Users Online ({otherUsers.length}):</strong>
          <ul style={{ margin: '8px 0 0 0', paddingLeft: 20 }}>
            {otherUsers.map(([clientId, state]) => (
              <li key={clientId} style={{ marginBottom: 4 }}>
                <span
                  style={{
                    display: 'inline-block',
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    backgroundColor: state.user?.color ?? '#999',
                    marginRight: 6
                  }}
                />
                {state.user?.name ?? `User ${clientId}`}
                {state.cursor && (
                  <span style={{ color: '#666', marginLeft: 8 }}>
                    @ ({state.cursor.x}, {state.cursor.y})
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div style={{ marginBottom: 16 }}>
        <label>
          Document Title (Y.Text):
          <input
            type="text"
            value={documentTitle ?? ''}
            onChange={(e) => dispatch('updateTitle', { title: e.target.value })}
            style={{ marginLeft: 8 }}
          />
        </label>
      </div>

      <div style={{ marginBottom: 16 }}>
        <button
          type="button"
          onClick={() => dispatch('togglePanel', { panel: 'left' })}
        >
          {leftPanel.collapsed ? 'Show' : 'Hide'} Left Panel ({leftPanel.width}
          px)
        </button>
      </div>

      <div style={{ marginBottom: 16 }}>
        <strong>Layers (Y.Array):</strong> {layers?.length ?? 0}
        <button
          type="button"
          onClick={() =>
            dispatch('addLayer', { name: `Layer ${(layers?.length ?? 0) + 1}` })
          }
          style={{ marginLeft: 8 }}
        >
          Add Layer
        </button>
        <ul>
          {layers?.map((layer, i) => (
            <li key={i}>{layer}</li>
          ))}
        </ul>
      </div>

      <div>
        <strong>Nodes (Y.Map):</strong> {Object.keys(nodes ?? {}).length}
        <button type="button" onClick={handleAddNode} style={{ marginLeft: 8 }}>
          Add Node
        </button>
      </div>

      <ul>
        {Object.entries(nodes ?? {}).map(([id, node]) => (
          <li
            key={id}
            style={{
              backgroundColor: selectedNodeId === id ? '#e0e0ff' : undefined
            }}
          >
            <button
              type="button"
              onClick={() => dispatch('selectNode', { id })}
              style={{ marginRight: 8 }}
            >
              Select
            </button>
            {id.slice(0, 8)}: ({node.x.toFixed(0)}, {node.y.toFixed(0)})
            <button
              type="button"
              onClick={() => dispatch('deleteNode', { id })}
              style={{ marginLeft: 8 }}
            >
              Delete
            </button>
          </li>
        ))}
      </ul>

      {selectedNodeId && (
        <div style={{ marginTop: 16, padding: 16, border: '1px solid #ccc' }}>
          <strong>Selected Node: {selectedNodeId.slice(0, 8)}</strong>
          <button
            type="button"
            onClick={() => dispatch('selectNode', { id: null })}
            style={{ marginLeft: 8 }}
          >
            Deselect
          </button>
        </div>
      )}
    </div>
  );
}
