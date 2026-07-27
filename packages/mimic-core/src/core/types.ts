export const HiddenTreeRootId = "$root";

export const ValueKinds = {
  String: "string",
  Number: "number",
  Boolean: "boolean",
  Object: "object",
  Array: "array",
  Tree: "tree",
} as const;

export type ValueKind = (typeof ValueKinds)[keyof typeof ValueKinds];

export type Path = readonly PathSegment[];

export const CommandKinds = {
  ValueSet: "value.set",
  ObjectSet: "object.set",
  ObjectDelete: "object.delete",
  ArrayInsert: "array.insert",
  ArrayMove: "array.move",
  ArrayDelete: "array.delete",
  TreeInsert: "tree.insert",
  TreeMove: "tree.move",
  TreeDelete: "tree.delete",
} as const;

export type CommandKind = (typeof CommandKinds)[keyof typeof CommandKinds];

export interface StringValue {
  readonly kind: "string";
  readonly value: string;
}

export interface NumberValue {
  readonly kind: "number";
  readonly value: number;
}

export interface BooleanValue {
  readonly kind: "boolean";
  readonly value: boolean;
}

export const stringValue = (value: string): StringValue => ({ kind: "string", value });
export const numberValue = (value: number): NumberValue => ({ kind: "number", value });
export const booleanValue = (value: boolean): BooleanValue => ({ kind: "boolean", value });

export interface ObjectValue {
  readonly kind: "object";
  readonly fields: Readonly<Record<string, Value>>;
}

export interface FieldPathSegment {
  readonly kind: "field";
  readonly key: string;
}

export interface ObjectSetCommand {
  readonly kind: "object.set";
  readonly path: Path;
  readonly key: string;
  readonly value: Value;
}

export interface ObjectDeleteCommand {
  readonly kind: "object.delete";
  readonly path: Path;
  readonly key: string;
}

export const objectValue = (fields: Readonly<Record<string, Value>> = {}): ObjectValue => ({
  kind: "object",
  fields,
});

export interface ArrayItem {
  readonly id: string;
  readonly pos: string;
  readonly value: Value;
}

export interface ArrayValue {
  readonly kind: "array";
  readonly items: readonly ArrayItem[];
}

export interface ItemPathSegment {
  readonly kind: "item";
  readonly id: string;
}

export interface ArrayInsertCommand {
  readonly kind: "array.insert";
  readonly path: Path;
  readonly item: ArrayItem;
}

export interface ArrayMoveCommand {
  readonly kind: "array.move";
  readonly path: Path;
  readonly id: string;
  readonly pos: string;
}

export interface ArrayDeleteCommand {
  readonly kind: "array.delete";
  readonly path: Path;
  readonly id: string;
}

export const arrayValue = (items: readonly ArrayItem[] = []): ArrayValue => ({
  kind: "array",
  items,
});

export interface TreeNode {
  readonly id: string;
  readonly parent: string;
  readonly pos: string;
  readonly value: ObjectValue;
}

export interface TreeValue {
  readonly kind: "tree";
  readonly nodes: readonly TreeNode[];
}

export interface NodePathSegment {
  readonly kind: "node";
  readonly id: string;
}

export interface TreeInsertCommand {
  readonly kind: "tree.insert";
  readonly path: Path;
  readonly node: TreeNode;
}

export interface TreeMoveCommand {
  readonly kind: "tree.move";
  readonly path: Path;
  readonly id: string;
  readonly parent: string;
  readonly pos: string;
}

export interface TreeDeleteCommand {
  readonly kind: "tree.delete";
  readonly path: Path;
  readonly id: string;
}

export const treeValue = (nodes: readonly TreeNode[] = []): TreeValue => ({
  kind: "tree",
  nodes,
});

export type Value = StringValue | NumberValue | BooleanValue | ObjectValue | ArrayValue | TreeValue;

export type PathSegment = FieldPathSegment | ItemPathSegment | NodePathSegment;

export interface ValueSetCommand {
  readonly kind: "value.set";
  readonly path: Path;
  readonly value: Value;
}

export type Command =
  | ValueSetCommand
  | ObjectSetCommand
  | ObjectDeleteCommand
  | ArrayInsertCommand
  | ArrayMoveCommand
  | ArrayDeleteCommand
  | TreeInsertCommand
  | TreeMoveCommand
  | TreeDeleteCommand;

export const clonePath = (path: Path | undefined): Path => (path ? [...path] : []);

export const cloneValue = (value: Value): Value => {
  switch (value.kind) {
    case "string":
    case "number":
    case "boolean":
      return { ...value };
    case "object": {
      const fields: Record<string, Value> = {};
      for (const [key, field] of Object.entries(value.fields)) {
        fields[key] = cloneValue(field);
      }
      return { kind: "object", fields };
    }
    case "array":
      return {
        kind: "array",
        items: value.items.map((item) => ({
          id: item.id,
          pos: item.pos,
          value: cloneValue(item.value),
        })),
      };
    case "tree":
      return {
        kind: "tree",
        nodes: value.nodes.map((node) => ({
          id: node.id,
          parent: node.parent,
          pos: node.pos,
          value: cloneValue(node.value) as ObjectValue,
        })),
      };
  }
};
