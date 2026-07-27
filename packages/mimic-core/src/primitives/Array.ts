import {
  arrayValue,
  cloneValue,
  type ArrayItem,
  type ArrayValue,
  type Path,
  type Value,
} from "../core/types.ts";
import { createGenerator } from "../fractional/index.ts";
import type { ArraySchema, ArrayValidator } from "../schema/types.ts";
import {
  getArrayAtPath,
  getArrayItemById,
  getArrayItemByIndex,
  getNeighborPositionsForInsert,
  getOrderedArrayItems,
  normalizeIndex,
} from "./path.ts";
import {
  PrimitiveError,
  type AnyPrimitive,
  type CommandSession,
  type InferInput,
  type InferProxy,
  type InferSnapshot,
  type MaybeUndefined,
  type PrimitiveWithOptionalEncoding,
  randomUuid,
} from "./shared.ts";

export interface ArrayEntrySnapshot<T> {
  readonly id: string;
  readonly pos: string;
  readonly value: T;
}

export interface ArrayItemHandle<TElement extends AnyPrimitive> {
  readonly id: string;
  readonly pos: string;
  readonly value: InferProxy<TElement>;
  get(): InferSnapshot<TElement> | undefined;
  remove(): void;
  move(toIndex: number): void;
  moveToPos(pos: string): void;
}

export interface ArrayProxy<TElement extends AnyPrimitive> {
  readonly length: number;
  get(): readonly ArrayEntrySnapshot<InferSnapshot<TElement>>[] | undefined;
  set(values: readonly InferInput<TElement>[]): void;
  push(value: InferInput<TElement>): ArrayItemHandle<TElement>;
  insertAt(index: number, value: InferInput<TElement>): ArrayItemHandle<TElement>;
  insertAtPos(pos: string, value: InferInput<TElement>): ArrayItemHandle<TElement>;
  remove(id: string): void;
  move(id: string, toIndex: number): void;
  moveToPos(id: string, pos: string): void;
  at(index: number): ArrayItemHandle<TElement> | undefined;
  first(): ArrayItemHandle<TElement> | undefined;
  last(): ArrayItemHandle<TElement> | undefined;
  findById(id: string): ArrayItemHandle<TElement> | undefined;
  find(
    predicate: (
      entry: ArrayItemHandle<TElement>,
      index: number,
      array: readonly ArrayItemHandle<TElement>[],
    ) => boolean,
  ): ArrayItemHandle<TElement> | undefined;
  findIndex(
    predicate: (
      entry: ArrayItemHandle<TElement>,
      index: number,
      array: readonly ArrayItemHandle<TElement>[],
    ) => boolean,
  ): number;
  map<TResult>(
    fn: (
      entry: ArrayItemHandle<TElement>,
      index: number,
      array: readonly ArrayItemHandle<TElement>[],
    ) => TResult,
  ): TResult[];
  filter(
    predicate: (
      entry: ArrayItemHandle<TElement>,
      index: number,
      array: readonly ArrayItemHandle<TElement>[],
    ) => boolean,
  ): ArrayItemHandle<TElement>[];
  some(
    predicate: (
      entry: ArrayItemHandle<TElement>,
      index: number,
      array: readonly ArrayItemHandle<TElement>[],
    ) => boolean,
  ): boolean;
  every(
    predicate: (
      entry: ArrayItemHandle<TElement>,
      index: number,
      array: readonly ArrayItemHandle<TElement>[],
    ) => boolean,
  ): boolean;
  forEach(
    fn: (
      entry: ArrayItemHandle<TElement>,
      index: number,
      array: readonly ArrayItemHandle<TElement>[],
    ) => void,
  ): void;
  [Symbol.iterator](): Iterator<ArrayItemHandle<TElement>>;
}

interface ArrayPrimitiveSchema<TElement extends AnyPrimitive> {
  readonly required: boolean;
  readonly defaultValue: readonly InferInput<TElement>[] | undefined;
  readonly element: TElement;
  readonly validators: readonly ArrayValidator[];
}

export class ArrayPrimitive<
  TElement extends AnyPrimitive,
  TRequired extends boolean = false,
  THasDefault extends boolean = false,
> implements PrimitiveWithOptionalEncoding<
  readonly InferInput<TElement>[] | undefined,
  MaybeUndefined<readonly ArrayEntrySnapshot<InferSnapshot<TElement>>[], TRequired, THasDefault>,
  ArrayProxy<TElement>
> {
  readonly _tag = "ArrayPrimitive";
  readonly _Input!: readonly InferInput<TElement>[] | undefined;
  readonly _Snapshot!: MaybeUndefined<
    readonly ArrayEntrySnapshot<InferSnapshot<TElement>>[],
    TRequired,
    THasDefault
  >;
  readonly _Proxy!: ArrayProxy<TElement>;

  private readonly state: ArrayPrimitiveSchema<TElement>;
  private encodedDefaultCache: { readonly value: ArrayValue | undefined } | undefined;

  constructor(state: ArrayPrimitiveSchema<TElement>) {
    this.state = state;
  }

  /**
   * Lazily encodes the configured default value, memoizing on first use.
   *
   * `encodeEntries` assigns random fractional-index positions and item ids via
   * the crypto RNG, which workerd forbids in global scope. Schemas are declared
   * as module-level constants, so deferring this out of `.default()` keeps those
   * declarations free of random I/O — the encode runs on first `schema`/`encode`
   * access, which happens inside a request handler. The wrapper object lets a
   * memoized `undefined` (no default) be distinguished from "not yet computed".
   */
  private encodedDefault(): ArrayValue | undefined {
    if (this.encodedDefaultCache === undefined) {
      this.encodedDefaultCache = {
        value:
          this.state.defaultValue === undefined
            ? undefined
            : this.encodeEntries(this.state.defaultValue),
      };
    }
    return this.encodedDefaultCache.value;
  }

  get element(): TElement {
    return this.state.element;
  }

  get schema(): ArraySchema {
    const encodedDefault = this.encodedDefault();
    return {
      kind: "array" as const,
      element: this.state.element.schema,
      ...(this.state.required ? { required: true } : {}),
      ...(encodedDefault !== undefined
        ? { default: cloneValue(encodedDefault) as ArrayValue }
        : {}),
      ...(this.state.validators.length > 0 ? { validators: this.state.validators } : {}),
    };
  }

  required(): ArrayPrimitive<TElement, true, THasDefault> {
    return new ArrayPrimitive({
      ...this.state,
      required: true,
    });
  }

  default(
    defaultValue: readonly InferInput<TElement>[],
  ): ArrayPrimitive<TElement, TRequired, true> {
    return new ArrayPrimitive({
      ...this.state,
      defaultValue,
    });
  }

  minLength(length: number): ArrayPrimitive<TElement, TRequired, THasDefault> {
    return new ArrayPrimitive({
      ...this.state,
      validators: [...this.state.validators, { kind: "minLength", value: length }],
    });
  }

  maxLength(length: number): ArrayPrimitive<TElement, TRequired, THasDefault> {
    return new ArrayPrimitive({
      ...this.state,
      validators: [...this.state.validators, { kind: "maxLength", value: length }],
    });
  }

  encode(input: readonly InferInput<TElement>[] | undefined): Value {
    const encoded = this.encodeOptional(input);
    if (encoded === undefined) {
      throw new PrimitiveError("Array value is undefined");
    }
    return encoded;
  }

  encodeOptional(input: unknown): Value | undefined {
    if (input === undefined) {
      const encodedDefault = this.encodedDefault();
      if (encodedDefault !== undefined) {
        return cloneValue(encodedDefault);
      }
      if (this.state.required) {
        throw new PrimitiveError("Array value is required");
      }
      return undefined;
    }
    if (!globalThis.Array.isArray(input)) {
      throw new PrimitiveError("Expected array input");
    }
    return this.encodeEntries(input as readonly InferInput<TElement>[]);
  }

  decode(
    value: Value | undefined,
  ): readonly ArrayEntrySnapshot<InferSnapshot<TElement>>[] | undefined {
    if (value?.kind !== "array") {
      return undefined;
    }
    return getOrderedArrayItems(value).map((item) => ({
      id: item.id,
      pos: item.pos,
      value: this.state.element.decode(item.value) as InferSnapshot<TElement>,
    }));
  }

  createProxy(session: CommandSession, path: Path): ArrayProxy<TElement> {
    const createHandle = (id: string): ArrayItemHandle<TElement> => ({
      get id() {
        return id;
      },
      get pos() {
        return getArrayItemById(getArrayAtPath(session.current(), path), id)?.pos ?? "";
      },
      get value() {
        return thisPrimitive.state.element.createProxy(session, [...path, { kind: "item", id }]);
      },
      get: () => {
        const item = getArrayItemById(getArrayAtPath(session.current(), path), id);
        return this.state.element.decode(item?.value) as InferSnapshot<TElement> | undefined;
      },
      remove: () => {
        session.emit([{ kind: "array.delete", path, id }]);
      },
      move: (toIndex) => {
        moveArrayItem(session, path, id, toIndex);
      },
      moveToPos: (pos) => {
        session.emit([{ kind: "array.move", path, id, pos }]);
      },
    });

    const createHandles = (): ArrayItemHandle<TElement>[] =>
      getOrderedArrayItems(getArrayAtPath(session.current(), path)).map((item) =>
        createHandle(item.id),
      );

    const thisPrimitive = this;
    return {
      get length() {
        return getOrderedArrayItems(getArrayAtPath(session.current(), path)).length;
      },
      get: () => this.decode(getArrayAtPath(session.current(), path)),
      set: (values) => {
        session.emit([{ kind: "value.set", path, value: this.encode(values) }]);
      },
      push: (value) => {
        const items = getOrderedArrayItems(getArrayAtPath(session.current(), path));
        const lower = items.length === 0 ? undefined : items[items.length - 1]?.pos;
        const id = session.generator.nextArrayItemId(path);
        const pos = session.generator.between(lower, undefined);
        session.emit([
          {
            kind: "array.insert",
            path,
            item: { id, pos, value: this.state.element.encode(value) },
          },
        ]);
        return createHandle(id);
      },
      insertAt: (index, value) => {
        const items = getOrderedArrayItems(getArrayAtPath(session.current(), path));
        const neighbors = getNeighborPositionsForInsert(
          items.map((item) => item.pos),
          index,
        );
        const id = session.generator.nextArrayItemId(path);
        const pos = session.generator.between(neighbors.lower, neighbors.upper);
        session.emit([
          {
            kind: "array.insert",
            path,
            item: { id, pos, value: this.state.element.encode(value) },
          },
        ]);
        return createHandle(id);
      },
      insertAtPos: (pos, value) => {
        const id = session.generator.nextArrayItemId(path);
        session.emit([
          {
            kind: "array.insert",
            path,
            item: { id, pos, value: this.state.element.encode(value) },
          },
        ]);
        return createHandle(id);
      },
      remove: (id) => {
        session.emit([{ kind: "array.delete", path, id }]);
      },
      move: (id, toIndex) => {
        moveArrayItem(session, path, id, toIndex);
      },
      moveToPos: (id, pos) => {
        session.emit([{ kind: "array.move", path, id, pos }]);
      },
      at: (index) => {
        const item = getArrayItemByIndex(getArrayAtPath(session.current(), path), index);
        return item ? createHandle(item.id) : undefined;
      },
      first: () => {
        const item = getArrayItemByIndex(getArrayAtPath(session.current(), path), 0);
        return item ? createHandle(item.id) : undefined;
      },
      last: () => {
        const items = getOrderedArrayItems(getArrayAtPath(session.current(), path));
        const item = items[items.length - 1];
        return item ? createHandle(item.id) : undefined;
      },
      findById: (id) => {
        const item = getArrayItemById(getArrayAtPath(session.current(), path), id);
        return item ? createHandle(item.id) : undefined;
      },
      find: (predicate) => {
        const handles = createHandles();
        return handles.find((entry, index, array) => predicate(entry, index, array));
      },
      findIndex: (predicate) => {
        const handles = createHandles();
        return handles.findIndex((entry, index, array) => predicate(entry, index, array));
      },
      map: (fn) => {
        const handles = createHandles();
        return handles.map((entry, index, array) => fn(entry, index, array));
      },
      filter: (predicate) => {
        const handles = createHandles();
        return handles.filter((entry, index, array) => predicate(entry, index, array));
      },
      some: (predicate) => {
        const handles = createHandles();
        return handles.some((entry, index, array) => predicate(entry, index, array));
      },
      every: (predicate) => {
        const handles = createHandles();
        return handles.every((entry, index, array) => predicate(entry, index, array));
      },
      forEach: (fn) => {
        const handles = createHandles();
        handles.forEach((entry, index, array) => fn(entry, index, array));
      },
      [Symbol.iterator]: () => createHandles()[Symbol.iterator](),
    };
  }

  optional(stripDefaults: boolean): ArrayPrimitive<TElement, false, false> {
    return new ArrayPrimitive({
      ...this.state,
      required: false,
      defaultValue: stripDefaults ? undefined : this.state.defaultValue,
    });
  }

  private encodeEntries(values: readonly InferInput<TElement>[]): ArrayValue {
    const generator = createGenerator();
    const ids = new Set<string>();
    let lower: string | undefined;
    const items: ArrayItem[] = values.map((value) => {
      const pos = generator.between(lower, undefined);
      lower = pos;
      let id = randomUuid();
      while (ids.has(id)) {
        id = randomUuid();
      }
      ids.add(id);
      return {
        id,
        pos,
        value: this.state.element.encode(value),
      };
    });
    return arrayValue(items);
  }
}

const moveArrayItem = (session: CommandSession, path: Path, id: string, toIndex: number): void => {
  const items = getOrderedArrayItems(getArrayAtPath(session.current(), path));
  const currentIndex = items.findIndex((item) => item.id === id);
  if (currentIndex === -1) {
    throw new PrimitiveError(`Array item "${id}" does not exist`);
  }
  const withoutItem = items.filter((item) => item.id !== id);
  const normalized = normalizeIndex(toIndex, withoutItem.length + 1);
  if (normalized === undefined && !(toIndex === withoutItem.length)) {
    throw new PrimitiveError(`Index ${toIndex} is out of range`);
  }
  const insertionIndex = normalized ?? withoutItem.length;
  const neighbors = getNeighborPositionsForInsert(
    withoutItem.map((item) => item.pos),
    insertionIndex,
  );
  const pos = session.generator.between(neighbors.lower, neighbors.upper);
  session.emit([{ kind: "array.move", path, id, pos }]);
};

export const Array = <TElement extends AnyPrimitive>(
  element: TElement,
): ArrayPrimitive<TElement, false, false> =>
  new ArrayPrimitive({
    required: false,
    defaultValue: undefined,
    element,
    validators: [],
  });
