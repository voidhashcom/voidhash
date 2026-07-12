/**
 * Kanban board commands using zustand-commander.
 *
 * This file defines all the commands for the Kanban board with undo/redo support.
 */

import { createCommander, type CommanderSlice } from "@voidhash/mimic/zustand-commander";
import type { MimicSlice } from "@voidhash/mimic/zustand";
import { Primitive } from "@voidhash/mimic-core";
import {
  BoardNode,
  CardNode,
  ColumnNode,
  MimicExampleSchema,
  type ExamplePresence,
} from "../shared";

type KanbanRoot = Primitive.InferProxy<typeof MimicExampleSchema>;
type BoardProxy = Primitive.TypedNodeProxy<typeof BoardNode>;
type CardProxy = Primitive.TypedNodeProxy<typeof CardNode>;

type ColumnRestoreData = {
  name: string;
  cards: Array<{ title: string; description: string }>;
};

type CardLocation = {
  columnId: string;
  cardIndex: number;
  cardData: { title: string; description: string };
};

export type KanbanStoreState = MimicSlice<typeof MimicExampleSchema, ExamplePresence> & {
  selectedCardId: string | null;
} & CommanderSlice;

export const commander = createCommander<KanbanStoreState, typeof MimicExampleSchema>();

const getBoard = (root: KanbanRoot): BoardProxy | undefined => root.children.first()?.as(BoardNode);

const getColumnIndex = (board: BoardProxy, columnId: string): number =>
  board.children.findIndex((column) => column.id === columnId);

const getColumnRestoreData = (board: BoardProxy, columnId: string): ColumnRestoreData | null => {
  const column = board.children.findById(columnId);
  if (!column) {
    return null;
  }

  return {
    name: column.data.name.get() ?? "",
    cards: column.children.map((card: CardProxy) => ({
      title: card.data.title.get() ?? "",
      description: card.data.description.get() ?? "",
    })),
  };
};

const getCardLocation = (board: BoardProxy, cardId: string): CardLocation | undefined => {
  for (const column of board.children) {
    const typedColumn = column.as(ColumnNode);
    const cardIndex = typedColumn.children.findIndex((card: CardProxy) => card.id === cardId);
    if (cardIndex === -1) {
      continue;
    }

    const card = typedColumn.children.at(cardIndex);
    if (!card) {
      continue;
    }

    return {
      columnId: typedColumn.id,
      cardIndex,
      cardData: {
        title: card.data.title.get() ?? "",
        description: card.data.description.get() ?? "",
      },
    };
  }

  return undefined;
};

export const addColumn = commander.undoableAction<{ title: string }, { columnId: string }>(
  (ctx, params) => {
    const board = getBoard(ctx.root);
    if (!board) {
      return { columnId: "" };
    }

    const column = board.children.insertLast({
      type: "column",
      name: params.title,
    });

    return { columnId: column.id };
  },
  (ctx, _params, result) => {
    ctx.root.children.findById(result.columnId)?.remove();
  },
);

export const renameColumn = commander.undoableAction<
  { columnId: string; title: string },
  { previousTitle: string }
>(
  (ctx, params) => {
    const column = ctx.root.children.findById(params.columnId);
    if (!column) {
      return { previousTitle: "" };
    }

    const previousTitle = column.data.name.get() ?? "";
    column.data.name.set(params.title);
    return { previousTitle };
  },
  (ctx, params, result) => {
    ctx.root
      .findByIdAcrossTree(params.columnId)
      ?.as(ColumnNode)
      .data.name.set(result.previousTitle);
  },
);

export const deleteColumn = commander.undoableAction<
  { columnId: string },
  { columnData: ColumnRestoreData | null; columnPos: string }
>(
  (ctx, params) => {
    const board = getBoard(ctx.root);
    if (!board) {
      return { columnData: null, columnPos: "" };
    }

    const column = board.children.findById(params.columnId);
    if (!column) {
      return { columnData: null, columnPos: "" };
    }
    const columnData = getColumnRestoreData(board, params.columnId);
    column.remove();
    return { columnData, columnPos: column.pos };
  },
  (ctx, _params, result) => {
    if (!result.columnData) {
      return;
    }

    const board = getBoard(ctx.root);
    if (!board) {
      return;
    }

    board.children.insertAtPos(result.columnPos, {
      type: "column",
      name: result.columnData.name,
      children: result.columnData.cards.map((card) => ({
        type: "card" as const,
        title: card.title,
        description: card.description,
        children: [],
      })),
    });
  },
);

export const addCard = commander.undoableAction<
  { columnId: string; title: string; description?: string },
  { cardId: string }
>(
  (ctx, params) => {
    const column = ctx.root.findByIdAcrossTree(params.columnId)?.as(ColumnNode);
    if (!column) {
      return { cardId: "" };
    }

    const card = column.children.insertLast({
      type: "card",
      title: params.title,
      description: params.description ?? "",
    });

    return { cardId: card.id };
  },
  (ctx, _params, result) => {
    ctx.root.findByIdAcrossTree(result.cardId)?.as(CardNode).remove();
  },
);

export const updateCard = commander.undoableAction<
  { cardId: string; title: string; description?: string },
  { previousTitle: string; previousDescription: string }
>(
  (ctx, params) => {
    const card = ctx.root.findByIdAcrossTree(params.cardId)?.as(CardNode);
    if (!card) {
      return { previousTitle: "", previousDescription: "" };
    }

    const previousTitle = card.data.title.get() ?? "";
    const previousDescription = card.data.description.get() ?? "";

    ctx.transaction(() => {
      card.data.title.set(params.title);
      card.data.description.set(params.description ?? "");
    });

    return { previousTitle, previousDescription };
  },
  (ctx, params, result) => {
    const card = ctx.root.findByIdAcrossTree(params.cardId)?.as(CardNode);
    if (!card) {
      return;
    }

    ctx.transaction(() => {
      card.data.title.set(result.previousTitle);
      card.data.description.set(result.previousDescription);
    });
  },
);

export const deleteCard = commander.undoableAction<
  { cardId: string },
  {
    cardData: { title: string; description: string } | null;
    columnId: string | null;
    cardIndex: number;
  }
>(
  (ctx, params) => {
    const board = getBoard(ctx.root);
    const location = board ? getCardLocation(board, params.cardId) : undefined;

    ctx.root.findByIdAcrossTree(params.cardId)?.as(CardNode).remove();

    return {
      cardData: location?.cardData ?? null,
      columnId: location?.columnId ?? null,
      cardIndex: location?.cardIndex ?? -1,
    };
  },
  (ctx, _params, result) => {
    if (!result.cardData || !result.columnId) {
      return;
    }

    const column = ctx.root.findByIdAcrossTree(result.columnId)?.as(ColumnNode);
    if (!column) {
      return;
    }

    column.children.insertAt(result.cardIndex, {
      type: "card",
      title: result.cardData.title,
      description: result.cardData.description,
    });
  },
);

export const moveCard = commander.undoableAction<
  { cardId: string; destinationColumnId: string; destinationIndex: number },
  { sourceColumnId: string | null; sourceIndex: number }
>(
  (ctx, params) => {
    const board = getBoard(ctx.root);
    const location = board ? getCardLocation(board, params.cardId) : undefined;
    const card = ctx.root.findByIdAcrossTree(params.cardId)?.as(CardNode);
    const destinationColumn = ctx.root
      .findByIdAcrossTree(params.destinationColumnId)
      ?.as(ColumnNode);
    if (!card || !destinationColumn) {
      return {
        sourceColumnId: location?.columnId ?? null,
        sourceIndex: location?.cardIndex ?? -1,
      };
    }

    card.moveTo(destinationColumn.children, params.destinationIndex);

    return {
      sourceColumnId: location?.columnId ?? null,
      sourceIndex: location?.cardIndex ?? -1,
    };
  },
  (ctx, params, result) => {
    if (!result.sourceColumnId) {
      return;
    }

    const card = ctx.root.findByIdAcrossTree(params.cardId)?.as(CardNode);
    const sourceColumn = ctx.root.findByIdAcrossTree(result.sourceColumnId)?.as(ColumnNode);
    if (!card || !sourceColumn) {
      return;
    }

    card.moveTo(sourceColumn.children, result.sourceIndex);
  },
);

export const reorderColumn = commander.undoableAction<
  { columnId: string; destinationIndex: number },
  { sourceIndex: number }
>(
  (ctx, params) => {
    const board = getBoard(ctx.root);
    const sourceIndex = board ? getColumnIndex(board, params.columnId) : -1;
    const column = ctx.root.findByIdAcrossTree(params.columnId)?.as(ColumnNode);
    if (!column) {
      return { sourceIndex };
    }

    if (!board) {
      return { sourceIndex };
    }

    column.moveTo(board.children, params.destinationIndex);
    return { sourceIndex };
  },
  (ctx, params, result) => {
    const board = getBoard(ctx.root);
    const column = ctx.root.findByIdAcrossTree(params.columnId)?.as(ColumnNode);
    if (!column || !board) {
      return;
    }

    column.moveTo(board.children, result.sourceIndex);
  },
);

export const selectCard = commander.action<{ cardId: string | null }>((ctx, params) => {
  ctx.setState({ selectedCardId: params.cardId });
});
