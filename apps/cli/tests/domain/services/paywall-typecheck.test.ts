import { promises as fsp } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Effect } from "effect";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  PAYWALL_ASSET_EXTENSIONS,
  PaywallTypecheckError,
  typecheckPaywallSources,
} from "../../../src/domain/services/paywall-typecheck";

let projectRoot: string;

const writeSource = async (relPath: string, contents: string) => {
  const abs = join(projectRoot, relPath);
  await fsp.mkdir(join(abs, ".."), { recursive: true });
  await fsp.writeFile(abs, contents);
  return abs;
};

beforeAll(async () => {
  projectRoot = await fsp.mkdtemp(join(tmpdir(), "voidhash-typecheck-"));
});

afterAll(async () => {
  await fsp.rm(projectRoot, { force: true, recursive: true });
});

describe("typecheckPaywallSources", () => {
  it("passes a source importing a .png via the injected asset declarations", async () => {
    const entry = await writeSource(
      ".voidhash/paywalls/with-asset.ts",
      ['import hero from "./hero.png";', "export const heroUrl: string = hero;", ""].join("\n"),
    );

    await expect(
      Effect.runPromise(typecheckPaywallSources({ files: [entry], projectRoot })),
    ).resolves.toBeUndefined();
  });

  it("covers every esbuild-supported asset extension", async () => {
    const imports = PAYWALL_ASSET_EXTENSIONS.map(
      (ext, i) => `import asset${i} from "./asset.${ext}";`,
    );
    const uses = PAYWALL_ASSET_EXTENSIONS.map(
      (_, i) => `export const url${i}: string = asset${i};`,
    );
    const entry = await writeSource(
      ".voidhash/paywalls/all-assets.ts",
      [...imports, ...uses, ""].join("\n"),
    );

    await expect(
      Effect.runPromise(typecheckPaywallSources({ files: [entry], projectRoot })),
    ).resolves.toBeUndefined();
  });

  it("still fails a genuinely type-broken source", async () => {
    const entry = await writeSource(
      ".voidhash/paywalls/broken.ts",
      ['import hero from "./hero.png";', "export const broken: number = hero;", ""].join("\n"),
    );

    const error = await Effect.runPromise(
      typecheckPaywallSources({ files: [entry], projectRoot }).pipe(Effect.flip),
    );
    expect(error).toBeInstanceOf(PaywallTypecheckError);
    expect(error.message).toContain("broken.ts");
  });

  it("still fails an import of an undeclared module kind", async () => {
    const entry = await writeSource(
      ".voidhash/paywalls/bad-import.ts",
      ['import data from "./data.bin";', "export const d = data;", ""].join("\n"),
    );

    const error = await Effect.runPromise(
      typecheckPaywallSources({ files: [entry], projectRoot }).pipe(Effect.flip),
    );
    expect(error).toBeInstanceOf(PaywallTypecheckError);
  });
});
