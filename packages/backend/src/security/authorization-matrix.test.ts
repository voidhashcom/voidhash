import { NodeServices } from "@effect/platform-node";
import { VoidhashV1Api } from "@voidhash/api-contracts";
import { RpcGroups } from "@voidhash/rpc";
import { Effect, FileSystem } from "effect";
import { describe, expect, it } from "vite-plus/test";

const MATRIX_PATH = decodeURIComponent(
  new URL("../../../../docs/security/endpoint-authorization-matrix.md", import.meta.url).pathname,
);

const markedBlock = (name: "HTTP" | "RPC") =>
  Effect.gen(function* () {
    const fileSystem = yield* FileSystem.FileSystem;
    const matrix = yield* fileSystem.readFileString(MATRIX_PATH);
    const start = `<!-- ${name}_OPERATIONS_START -->`;
    const end = `<!-- ${name}_OPERATIONS_END -->`;
    const startIndex = matrix.indexOf(start);
    const endIndex = matrix.indexOf(end);
    if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) {
      return yield* Effect.die(
        new Error(`Missing ${name} operation markers in authorization matrix`),
      );
    }
    return matrix.slice(startIndex + start.length, endIndex);
  });

const codeSpans = (input: string) =>
  [...input.matchAll(/`([^`]+)`/g)].map((match) => match[1]!).sort();

describe("endpoint authorization matrix", () => {
  it("lists every HTTP API contract operation exactly once", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const contractOperations = Object.entries(VoidhashV1Api.groups)
          .flatMap(([groupName, group]) =>
            Object.keys(group.endpoints).map((endpointName) => `${groupName}.${endpointName}`),
          )
          .sort();
        expect(codeSpans(yield* markedBlock("HTTP"))).toEqual(contractOperations);
      }).pipe(Effect.provide(NodeServices.layer)),
    ));

  it("lists every RPC contract operation exactly once", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const contractOperations = [...RpcGroups.requests.keys()].sort();
        expect(codeSpans(yield* markedBlock("RPC"))).toEqual(contractOperations);
      }).pipe(Effect.provide(NodeServices.layer)),
    ));
});
