import { Schema } from 'effect';
import { Awareness } from 'y-protocols/awareness';
import * as Y from 'yjs';
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
} from '.';

// Define types for synced data
interface NodeData {
  x: number;
  y: number;
  width: number;
  height: number;
}

// 1. Define the schema with 3 state categories
//    Use syncMap/syncArray/syncText to mark how fields are synced
const schema = createVoidsyncSchema({
  // Ephemeral state shared via awareness protocol (cursors, selections, presence)
  awareness: Schema.Struct({
    cursor: Schema.NullOr(
      Schema.Struct({
        x: Schema.Number,
        y: Schema.Number
      })
    ),
    user: Schema.Struct({
      name: Schema.String,
      color: Schema.String
    })
  }),
  // Local browser state, not synced (UI preferences, panel sizes)
  browser: Schema.Struct({
    panels: Schema.Struct({
      left: Schema.Struct({
        width: Schema.Number,
        collapsed: Schema.Boolean
      }),
      right: Schema.Struct({
        width: Schema.Number,
        collapsed: Schema.Boolean
      })
    }),
    selectedNodeId: Schema.NullOr(Schema.String)
  }),
  // Persisted state synced to the document
  // Each key here maps to a sync type based on the marker:
  synced: {
    // syncMap() → backed by Y.Map, synced as Record<string, T>
    nodes: syncMap<NodeData>(),
    // syncArray() → backed by Y.Array, synced as T[]
    layers: syncArray<string>(),
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
        color: `#${Math.floor(Math.random() * 16_777_215).toString(16)}`
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

// 4. Define actions using Effect Schema for params
const addNodeAction = designerStoreState.action(
  Schema.Struct({
    x: Schema.Number,
    y: Schema.Number,
    width: Schema.Number,
    height: Schema.Number
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
  Schema.NullOr(Schema.Struct({ id: Schema.String })),
  ({ setBrowser, params }) => {
    // Only affects local browser state
    setBrowser({ selectedNodeId: params?.id ?? null });
  }
);

const moveNodeAction = designerStoreState.action(
  Schema.Struct({
    id: Schema.String,
    x: Schema.Number,
    y: Schema.Number
  }),
  ({ doc, getState, params }) => {
    // Read current state
    const currentNode = getState().nodes?.[params.id];
    if (!currentNode) {
      return;
    }

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
  Schema.Struct({ id: Schema.String }),
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
  Schema.NullOr(Schema.Struct({ x: Schema.Number, y: Schema.Number })),
  ({ setAwareness, params }) => {
    // Update awareness (ephemeral, shared with all users)
    setAwareness({ cursor: params });
  }
);

const togglePanelAction = designerStoreState.action(
  Schema.Struct({ panel: Schema.Literal('left', 'right') }),
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
  Schema.Struct({ name: Schema.String }),
  ({ doc, params }) => {
    // Modify Y.Array (persisted)
    const layersArray = doc.getArray<string>('layers');
    layersArray.push([params.name]);
  }
);

const updateTitleAction = designerStoreState.action(
  Schema.Struct({ title: Schema.String }),
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
    // biome-ignore lint/a11y/noStaticElementInteractions: <explanation>
    // biome-ignore lint/nursery/noNoninteractiveElementInteractions: <explanation>
    <div onMouseLeave={handleMouseLeave} onMouseMove={handleMouseMove}>
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
            onChange={(e) => dispatch('updateTitle', { title: e.target.value })}
            style={{ marginLeft: 8 }}
            type="text"
            value={documentTitle ?? ''}
          />
        </label>
      </div>

      <div style={{ marginBottom: 16 }}>
        <button
          onClick={() => dispatch('togglePanel', { panel: 'left' })}
          type="button"
        >
          {leftPanel.collapsed ? 'Show' : 'Hide'} Left Panel ({leftPanel.width}
          px)
        </button>
      </div>

      <div style={{ marginBottom: 16 }}>
        <strong>Layers (Y.Array):</strong> {layers?.length ?? 0}
        <button
          onClick={() =>
            dispatch('addLayer', { name: `Layer ${(layers?.length ?? 0) + 1}` })
          }
          style={{ marginLeft: 8 }}
          type="button"
        >
          Add Layer
        </button>
        <ul>
          {layers?.map((layer, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: layer is a string
            <li key={i}>{layer}</li>
          ))}
        </ul>
      </div>

      <div>
        <strong>Nodes (Y.Map):</strong> {Object.keys(nodes ?? {}).length}
        <button onClick={handleAddNode} style={{ marginLeft: 8 }} type="button">
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
              onClick={() => dispatch('selectNode', { id })}
              style={{ marginRight: 8 }}
              type="button"
            >
              Select
            </button>
            {id.slice(0, 8)}: ({node.x.toFixed(0)}, {node.y.toFixed(0)})
            <button
              onClick={() => dispatch('deleteNode', { id })}
              style={{ marginLeft: 8 }}
              type="button"
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
            onClick={() => dispatch('selectNode', null)}
            style={{ marginLeft: 8 }}
            type="button"
          >
            Deselect
          </button>
        </div>
      )}
    </div>
  );
}
