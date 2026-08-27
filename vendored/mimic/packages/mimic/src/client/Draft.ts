import {
  Primitive,
  applyBatch,
  createGenerator,
  type Command,
  type Path,
  type Value,
} from "@voidhash/mimic-core";

import { randomUuid, shortId } from "../shared/ids.js";
import { InvalidStateError } from "./errors.js";
import type { DraftHandle } from "./types.js";

const createDraftSession = (
  getCurrentValue: () => Value,
  applyCommands: (commands: readonly Command[]) => void,
): Primitive.CommandSession => {
  const generator = createGenerator();
  return {
    current: getCurrentValue,
    emit: applyCommands,
    generator: {
      nextArrayItemId: (_path: Path) => randomUuid(),
      // Node ids appear in printed composition source, so they are short.
      nextTreeNodeId: (_path: Path) => shortId(),
      between: (lower?: string, upper?: string) => generator.between(lower, upper),
    },
  };
};

export class DraftHandleImpl<
  TPrimitive extends Primitive.AnyPrimitive,
> implements DraftHandle<TPrimitive> {
  readonly id = randomUuid();
  readonly root: Primitive.InferProxy<TPrimitive>;
  private currentValue: Value;
  private stagedCommands: Command[] = [];
  private consumed = false;
  private snapshotCacheValue: Value | undefined = undefined;
  private snapshotCache: Primitive.InferSnapshot<TPrimitive> | undefined = undefined;

  constructor(
    private readonly primitive: TPrimitive,
    baseValue: Value,
    private readonly onCommit: (commands: readonly Command[]) => void,
    private readonly onDispose: (id: string) => void,
  ) {
    this.currentValue = baseValue;
    this.root = primitive.createProxy(
      createDraftSession(
        () => this.assertActiveValue(),
        (commands) => this.apply(commands),
      ),
      [],
    ) as Primitive.InferProxy<TPrimitive>;
  }

  getValue(): Value | undefined {
    return this.consumed ? undefined : this.currentValue;
  }

  /**
   * Decoded preview of the draft's staged value. Memoized on `currentValue`
   * identity (each `apply` swaps in a fresh value) so repeated calls return a
   * stable reference between edits — required by React's `useSyncExternalStore`
   * when a draft-aware selector reads this during render.
   */
  getSnapshot(): Primitive.InferSnapshot<TPrimitive> | undefined {
    if (this.consumed) {
      return undefined;
    }
    if (this.snapshotCacheValue !== this.currentValue) {
      this.snapshotCache = this.primitive.decode(this.currentValue);
      this.snapshotCacheValue = this.currentValue;
    }
    return this.snapshotCache;
  }

  transaction<R>(fn: (root: Primitive.InferProxy<TPrimitive>) => R): R {
    this.assertActive();
    let result!: R;
    const commands = Primitive.commands(this.primitive, this.currentValue, (root) => {
      result = fn(root);
    });
    this.apply(commands);
    return result;
  }

  update(fn: (root: Primitive.InferProxy<TPrimitive>) => void): void {
    this.assertActive();
    fn(this.root);
  }

  commit(): void {
    this.assertActive();
    const commands = [...this.stagedCommands];
    this.consume();
    if (commands.length > 0) {
      this.onCommit(commands);
    }
  }

  discard(): void {
    this.assertActive();
    this.consume();
  }

  private apply(commands: readonly Command[]): void {
    if (commands.length === 0) {
      return;
    }
    this.assertActive();
    this.stagedCommands.push(...commands);
    this.currentValue = applyBatch(this.currentValue, commands);
  }

  private consume(): void {
    this.consumed = true;
    this.onDispose(this.id);
  }

  private assertActive(): void {
    if (this.consumed) {
      throw new InvalidStateError("Draft has already been consumed");
    }
  }

  private assertActiveValue(): Value {
    this.assertActive();
    return this.currentValue;
  }
}
