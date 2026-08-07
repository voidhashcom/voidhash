import { NodeServices } from "@effect/platform-node";
import { Effect, FileSystem, Path } from "effect";
import { describe, expect, it } from "vitest";

/**
 * Workers-compatibility gate.
 *
 * The shipped SDK source (`src/`) must run unchanged on Cloudflare Workers
 * (workerd), which has no Node built-ins, no `Buffer`, and cannot load
 * `jsonwebtoken`/`jsrsasign`. This test fails if any of those creep back in —
 * the static guard the audit called for, runnable in the normal Node suite.
 *
 * Note: this scans `src/` only. Test files run on Node and may use the Node
 * `FileSystem`, `Buffer`, etc.
 */
const FORBIDDEN: ReadonlyArray<{ label: string; pattern: RegExp }> = [
  { label: "node: builtin import", pattern: /\bfrom\s+["']node:[^"']+["']/ },
  { label: "node: builtin require", pattern: /\brequire\(\s*["']node:[^"']+["']\)/ },
  { label: "bare 'crypto' import", pattern: /\bfrom\s+["']crypto["']/ },
  { label: "jsonwebtoken import", pattern: /\bfrom\s+["']jsonwebtoken["']/ },
  { label: "jsrsasign import", pattern: /\bfrom\s+["']jsrsasign["']/ },
  { label: "Buffer usage", pattern: /\bBuffer\s*[.(]/ },
  { label: "new Buffer", pattern: /\bnew\s+Buffer\b/ },
];

const scanShippedSource = Effect.gen(function* () {
  const fileSystem = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const srcDir = path.join(process.cwd(), "src");

  const entries = yield* fileSystem.readDirectory(srcDir, { recursive: true });
  const files = entries.filter((entry) => entry.endsWith(".ts"));
  expect(files.length).toBeGreaterThan(0);

  const violations: string[] = [];
  for (const file of files) {
    const contents = yield* fileSystem.readFileString(path.join(srcDir, file));
    contents.split("\n").forEach((line, index) => {
      for (const { label, pattern } of FORBIDDEN) {
        if (pattern.test(line)) {
          violations.push(`${file}:${index + 1} [${label}] ${line.trim()}`);
        }
      }
    });
  }

  expect(
    violations,
    `Node-only APIs found in shipped src (these break on Cloudflare Workers):\n${violations.join("\n")}`,
  ).toEqual([]);
});

describe("Workers compatibility: no Node-only APIs in src", () => {
  it("has zero node:/Buffer/jsonwebtoken/jsrsasign references in shipped source", () =>
    Effect.runPromise(scanShippedSource.pipe(Effect.provide(NodeServices.layer))));
});
