import { makeMethods } from "@effect/vitest";
import { it as vitestIt } from "vitest";

export { beforeEach, describe, expect } from "vitest";
const makeVitestMethods = makeMethods as unknown as (it: typeof vitestIt) => typeof vitestIt;

export const it = makeVitestMethods(vitestIt);
