import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  base62,
  generateJitteredKeyBetween,
  generateKeyBetween,
  generateNKeysBetween,
  generateNJitteredKeysBetween,
  type RandomSource,
} from "../src/index.js";

interface FractionalCase {
  readonly name: string;
  readonly mode: "plain" | "jittered";
  readonly count?: number;
  readonly lower: string | null;
  readonly upper: string | null;
  readonly random?: readonly number[];
  readonly expect: readonly string[];
}

interface FractionalSuite {
  readonly version: number;
  readonly suite: string;
  readonly cases: readonly FractionalCase[];
}

class FixedRandomSource implements RandomSource {
  readonly values: readonly number[];
  index = 0;

  constructor(values: readonly number[]) {
    this.values = values;
  }

  next(): number {
    if (this.values.length === 0) {
      return 0;
    }
    if (this.index >= this.values.length) {
      return this.values[this.values.length - 1]!;
    }
    const value = this.values[this.index]!;
    this.index += 1;
    return value;
  }
}

const fixturesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");

const suite = JSON.parse(
  readFileSync(path.join(fixturesDir, "fractional.json"), "utf8"),
) as FractionalSuite;

describe("spec fractional fixtures", () => {
  it("uses the expected fixture suite version", () => {
    expect(suite.version).toBe(1);
  });

  for (const testCase of suite.cases) {
    it(testCase.name, () => {
      const count = testCase.count ?? 1;
      const lower = testCase.lower ?? undefined;
      const upper = testCase.upper ?? undefined;
      const charset = base62();

      let got: string[];
      switch (testCase.mode) {
        case "plain":
          got =
            count === 1
              ? [generateKeyBetween(lower, upper, charset)]
              : generateNKeysBetween(lower, upper, count, charset);
          break;
        case "jittered": {
          const random = new FixedRandomSource(testCase.random ?? []);
          got =
            count === 1
              ? [generateJitteredKeyBetween(lower, upper, charset, random)]
              : generateNJitteredKeysBetween(lower, upper, count, charset, random);
          break;
        }
      }

      expect(got).toEqual(testCase.expect);
    });
  }
});
