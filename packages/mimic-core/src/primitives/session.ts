import { applyBatch } from "../core/apply.ts";
import { type Command, type Value } from "../core/types.ts";
import { createGenerator } from "../fractional/index.ts";
import { validate as validateSchema } from "../schema/validate.ts";
import { validateValue } from "../core/validate.ts";
import {
  randomUuid,
  shortId,
  type AnyPrimitive,
  type CommandSession,
  type InferProxy,
} from "./shared.ts";

export const commands = <TRoot extends AnyPrimitive>(
  primitive: TRoot,
  snapshot: Value,
  build: (root: InferProxy<TRoot>) => void,
): readonly Command[] => {
  validateValue(snapshot);
  const baseSnapshot = validateSchema(primitive.schema, snapshot);
  if (baseSnapshot === undefined) {
    throw new Error("Primitive root snapshot cannot be undefined");
  }

  const staged: Command[] = [];
  let currentSnapshot = baseSnapshot;
  const generator = createGenerator();

  const session: CommandSession = {
    current: () => currentSnapshot,
    emit: (commandsToEmit) => {
      if (commandsToEmit.length === 0) {
        return;
      }
      staged.push(...commandsToEmit);
      currentSnapshot = applyBatch(baseSnapshot, staged);
    },
    generator: {
      nextArrayItemId: () => randomUuid(),
      // Node ids appear in printed composition source, so they are short.
      nextTreeNodeId: () => shortId(),
      between: (lower, upper) => generator.between(lower, upper),
    },
  };

  build(primitive.createProxy(session, []));
  return staged;
};
