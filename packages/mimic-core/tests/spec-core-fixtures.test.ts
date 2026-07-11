import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  applyBatch,
  isCoreError,
  normalize,
  type Command,
  type ErrorCode,
  type Value,
} from "../src/index.js";

interface FixtureIndex {
  readonly version: number;
  readonly suites: readonly string[];
}

interface FixtureCase {
  readonly name: string;
  readonly initial: Value;
  readonly commands: readonly Command[];
  readonly expect?: Value;
  readonly error?: {
    readonly code: ErrorCode;
  };
}

interface FixtureSuite {
  readonly version: number;
  readonly suite: string;
  readonly cases: readonly FixtureCase[];
}

const fixturesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");

const readJson = <T>(name: string): T =>
  JSON.parse(readFileSync(path.join(fixturesDir, name), "utf8")) as T;

const index = readJson<FixtureIndex>("index.json");

describe("spec core fixtures", () => {
  it("uses the expected fixture index version", () => {
    expect(index.version).toBe(1);
  });

  for (const suiteName of index.suites) {
    const suite = readJson<FixtureSuite>(suiteName);

    describe(suite.suite, () => {
      for (const testCase of suite.cases) {
        it(testCase.name, () => {
          try {
            const got = applyBatch(testCase.initial, testCase.commands);

            if (testCase.error) {
              expect.unreachable(`expected error ${testCase.error.code}, got success`);
            }
            expect(testCase.expect).toBeDefined();
            expect(normalize(got)).toEqual(normalize(testCase.expect!));
          } catch (error) {
            if (!testCase.error) {
              throw error;
            }
            expect(isCoreError(error)).toBe(true);
            expect((error as { code: ErrorCode }).code).toBe(testCase.error.code);
          }
        });
      }
    });
  }
});
