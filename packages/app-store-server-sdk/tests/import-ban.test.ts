import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Workers-compatibility gate.
 *
 * The shipped SDK source (`src/`) must run unchanged on Cloudflare Workers
 * (workerd), which has no Node built-ins, no `Buffer`, and cannot load
 * `jsonwebtoken`/`jsrsasign`. This test fails if any of those creep back in —
 * the static guard the audit called for, runnable in the normal Node suite.
 *
 * Note: this scans `src/` only. Test files run on Node and may use `node:fs`,
 * `Buffer`, etc.
 */
const SRC_DIR = path.join(process.cwd(), "src");

const FORBIDDEN: ReadonlyArray<{ label: string; pattern: RegExp }> = [
  { label: "node: builtin import", pattern: /\bfrom\s+["']node:[^"']+["']/ },
  { label: "node: builtin require", pattern: /\brequire\(\s*["']node:[^"']+["']\)/ },
  { label: "bare 'crypto' import", pattern: /\bfrom\s+["']crypto["']/ },
  { label: "jsonwebtoken import", pattern: /\bfrom\s+["']jsonwebtoken["']/ },
  { label: "jsrsasign import", pattern: /\bfrom\s+["']jsrsasign["']/ },
  { label: "Buffer usage", pattern: /\bBuffer\s*[.(]/ },
  { label: "new Buffer", pattern: /\bnew\s+Buffer\b/ },
];

const walk = (dir: string): string[] => {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walk(full));
    } else if (entry.isFile() && full.endsWith(".ts")) {
      out.push(full);
    }
  }
  return out;
};

describe("Workers compatibility: no Node-only APIs in src", () => {
  it("has zero node:/Buffer/jsonwebtoken/jsrsasign references in shipped source", () => {
    const files = walk(SRC_DIR);
    expect(files.length).toBeGreaterThan(0);

    const violations: string[] = [];
    for (const file of files) {
      const lines = fs.readFileSync(file, "utf-8").split("\n");
      lines.forEach((line, index) => {
        for (const { label, pattern } of FORBIDDEN) {
          if (pattern.test(line)) {
            violations.push(
              `${path.relative(SRC_DIR, file)}:${index + 1} [${label}] ${line.trim()}`,
            );
          }
        }
      });
    }

    expect(
      violations,
      `Node-only APIs found in shipped src (these break on Cloudflare Workers):\n${violations.join("\n")}`,
    ).toEqual([]);
  });
});
