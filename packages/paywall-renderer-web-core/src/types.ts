import type {
  FlexNodeData,
  RootNodeData,
  ScreenNodeData,
  TextNodeData
} from '@voidhash/mimic-schema';

export type NodeType = 'root' | 'screen' | 'flex' | 'text';

export type SnapshotNode =
  | RootSnapshotNode
  | ScreenSnapshotNode
  | FlexSnapshotNode
  | TextSnapshotNode;

export type RootSnapshotNode = RootNodeData & {
  children: SnapshotNode[];
};

export type ScreenSnapshotNode = ScreenNodeData & {
  children: SnapshotNode[];
};

export type FlexSnapshotNode = FlexNodeData & {
  children: SnapshotNode[];
};

export type TextSnapshotNode = TextNodeData & {
  children: SnapshotNode[];
};

export type RenderOptions = Record<string, never>;

export type RenderResult = {
  html: string;
};
