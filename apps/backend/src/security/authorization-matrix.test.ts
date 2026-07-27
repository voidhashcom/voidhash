import { VoidhashV1Api } from "@voidhash/api-contracts";
import { RpcGroups } from "@voidhash/rpc";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vite-plus/test";

const matrix = readFileSync(
  new URL("../../../../docs/security/endpoint-authorization-matrix.md", import.meta.url),
  "utf8",
);

const markedBlock = (name: "HTTP" | "RPC") => {
  const start = `<!-- ${name}_OPERATIONS_START -->`;
  const end = `<!-- ${name}_OPERATIONS_END -->`;
  const startIndex = matrix.indexOf(start);
  const endIndex = matrix.indexOf(end);
  if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) {
    throw new Error(`Missing ${name} operation markers in authorization matrix`);
  }
  return matrix.slice(startIndex + start.length, endIndex);
};

const codeSpans = (input: string) =>
  [...input.matchAll(/`([^`]+)`/g)].map((match) => match[1]!).sort();

describe("endpoint authorization matrix", () => {
  it("lists every HTTP API contract operation exactly once", () => {
    const contractOperations = Object.entries(VoidhashV1Api.groups)
      .flatMap(([groupName, group]) =>
        Object.keys(group.endpoints).map((endpointName) => `${groupName}.${endpointName}`),
      )
      .sort();
    expect(codeSpans(markedBlock("HTTP"))).toEqual(contractOperations);
  });

  it("lists every RPC contract operation exactly once", () => {
    const contractOperations = [...RpcGroups.requests.keys()].sort();
    expect(codeSpans(markedBlock("RPC"))).toEqual(contractOperations);
  });
});
