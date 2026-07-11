export interface Card {
  id: string;
  title: string;
  description?: string;
}

export interface Column {
  id: string;
  title: string;
  cardIds: string[];
}

export interface KanbanState {
  columns: Record<string, Column>;
  cards: Record<string, Card>;
  columnOrder: string[];
}

// Action types
export type KanbanAction =
  | { type: "ADD_COLUMN"; payload: { title: string } }
  | { type: "RENAME_COLUMN"; payload: { columnId: string; title: string } }
  | { type: "DELETE_COLUMN"; payload: { columnId: string } }
  | { type: "ADD_CARD"; payload: { columnId: string; title: string; description?: string } }
  | { type: "UPDATE_CARD"; payload: { cardId: string; title: string; description?: string } }
  | { type: "DELETE_CARD"; payload: { cardId: string; columnId: string } }
  | {
      type: "MOVE_CARD";
      payload: {
        cardId: string;
        sourceColumnId: string;
        destinationColumnId: string;
        sourceIndex: number;
        destinationIndex: number;
      };
    }
  | { type: "REORDER_COLUMNS"; payload: { sourceIndex: number; destinationIndex: number } };

export type DragItemType = "card" | "column";

export interface DragData {
  type: DragItemType;
  columnId?: string;
  cardId?: string;
}
