import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { AppError } from "./errors";
import { loadConfig } from "./config";

const createdDirs: string[] = [];

const makeTempConfigPath = async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "voidhash-mcp-config-"));
  createdDirs.push(directory);
  return path.join(directory, ".voidhash");
};

afterEach(async () => {
  await Promise.all(
    createdDirs.splice(0, createdDirs.length).map((directory) =>
      rm(directory, { force: true, recursive: true }),
    ),
  );
});

describe("loadConfig", () => {
  it("loads valid config and derives ws base URL", async () => {
    const configPath = await makeTempConfigPath();
    await writeFile(
      configPath,
      JSON.stringify({
        api_key: "test-token",
        api_url: "https://api.voidhash.test/api/v1",
      }),
      "utf8",
    );

    const loaded = await loadConfig({ configPath });

    expect(loaded.apiKey).toBe("test-token");
    expect(loaded.apiOrigin).toBe("https://api.voidhash.test");
    expect(loaded.wsBaseUrl).toBe("wss://api.voidhash.test/mimic/paywall-designer");
  });

  it("fails with CONFIG_ERROR when file does not exist", async () => {
    const missingPath = path.join(os.tmpdir(), `missing-${Date.now()}.voidhash`);

    await expect(loadConfig({ configPath: missingPath })).rejects.toMatchObject({
      code: "CONFIG_ERROR",
    } satisfies Partial<AppError>);
  });

  it("fails with AUTH_ERROR when api_key is missing", async () => {
    const configPath = await makeTempConfigPath();
    await writeFile(
      configPath,
      JSON.stringify({
        api_url: "https://api.voidhash.test/api/v1",
      }),
      "utf8",
    );

    await expect(loadConfig({ configPath })).rejects.toMatchObject({
      code: "AUTH_ERROR",
    } satisfies Partial<AppError>);
  });
});
