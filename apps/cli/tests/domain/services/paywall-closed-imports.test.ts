import { promises as fsp } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import * as esbuild from "esbuild";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { closedImportsPlugin } from "../../../src/domain/services/paywall-closed-imports";

let projectRoot: string;
let voidhashDir: string;

/** Bare modules marked external so "allowed" imports need no node_modules. */
const EXTERNALS = [
  "react",
  "react/jsx-runtime",
  "react/jsx-dev-runtime",
  "@voidhash/paywalls",
  "@voidhash/paywalls/*",
];

const writeSource = async (relPath: string, contents: string) => {
  const abs = join(projectRoot, relPath);
  await fsp.mkdir(join(abs, ".."), { recursive: true });
  await fsp.writeFile(abs, contents);
  return abs;
};

/** Bundles `entry` with the plugin; returns esbuild error texts ([] = ok). */
const buildErrors = async (
  entry: string,
  options: esbuild.BuildOptions = {},
): Promise<string[]> => {
  try {
    await esbuild.build({
      bundle: true,
      external: EXTERNALS,
      format: "esm",
      logLevel: "silent",
      plugins: [closedImportsPlugin(voidhashDir)],
      write: false,
      ...options,
      entryPoints: [entry],
    });
    return [];
  } catch (error) {
    return ((error as esbuild.BuildFailure).errors ?? []).map((e) => e.text);
  }
};

beforeAll(async () => {
  projectRoot = await fsp.mkdtemp(join(tmpdir(), "voidhash-closed-imports-"));
  voidhashDir = join(projectRoot, ".voidhash");
  await writeSource(
    ".voidhash/components/helper.ts",
    "export const helper = 1;\n",
  );
  await fsp.writeFile(
    join(projectRoot, "app-code.ts"),
    "export const y = 1;\n",
  );
});

afterAll(async () => {
  await fsp.rm(projectRoot, { force: true, recursive: true });
});

describe("closedImportsPlugin", () => {
  it("allows the allowlist plus relative imports within .voidhash", async () => {
    const entry = await writeSource(
      ".voidhash/components/allowed.ts",
      [
        'import "react";',
        'import "react/jsx-runtime";',
        'import "react/jsx-dev-runtime";',
        'import "@voidhash/paywalls";',
        'import "@voidhash/paywalls/dom";',
        'import "@voidhash/paywalls/panel";',
        'import { helper } from "./helper";',
        "export const ok = helper;",
      ].join("\n"),
    );

    expect(await buildErrors(entry)).toEqual([]);
  });

  it("rejects react-dom, naming the importing file", async () => {
    const entry = await writeSource(
      ".voidhash/components/uses-react-dom.ts",
      'import "react-dom";\nexport {};\n',
    );

    const errors = await buildErrors(entry, {
      external: [...EXTERNALS, "react-dom"],
    });
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('"react-dom"');
    expect(errors[0]).toContain("uses-react-dom.ts");
  });

  it("rejects arbitrary packages", async () => {
    const entry = await writeSource(
      ".voidhash/components/uses-lodash.ts",
      'import "lodash";\nexport {};\n',
    );

    const errors = await buildErrors(entry);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('"lodash"');
  });

  it("rejects the Node-only @voidhash/paywalls/tree entry", async () => {
    const entry = await writeSource(
      ".voidhash/components/uses-tree.ts",
      'import "@voidhash/paywalls/tree";\nexport {};\n',
    );

    const errors = await buildErrors(entry);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('"@voidhash/paywalls/tree"');
  });

  it("rejects relative imports escaping .voidhash", async () => {
    const entry = await writeSource(
      ".voidhash/components/escapes.ts",
      'import "../../app-code";\nexport {};\n',
    );

    const errors = await buildErrors(entry);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("escapes the .voidhash directory");
  });

  it("does not constrain imports made outside .voidhash (node_modules)", async () => {
    const entry = join(projectRoot, "vendor-entry.ts");
    await fsp.writeFile(entry, 'import "react-dom";\nexport {};\n');

    expect(
      await buildErrors(entry, { external: [...EXTERNALS, "react-dom"] }),
    ).toEqual([]);
  });
});
