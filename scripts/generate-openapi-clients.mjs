#!/usr/bin/env node

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const generatedClientsRoot = path.join(repoRoot, "packages/generated-clients");
const nodeGeneratedRoot = path.join(repoRoot, "libraries/node/src/generated");

const mode = process.argv[2];

if (mode !== "preview" && mode !== "production") {
  console.error("Usage: node ./scripts/generate-openapi-clients.mjs <preview|production>");
  process.exit(1);
}

const resolveUrl = (name, fallback) => {
  const value = process.env[name] ?? fallback;

  if (!value) {
    console.error(`Missing required environment variable: ${name}`);
    process.exit(1);
  }

  return value;
};

const specsByMode = {
  preview: {
    core: resolveUrl("VOIDHASH_PREVIEW_CORE_OPENAPI_URL"),
    eventCapture: resolveUrl("VOIDHASH_PREVIEW_EVENT_CAPTURE_OPENAPI_URL"),
  },
  production: {
    core: resolveUrl(
      "VOIDHASH_PRODUCTION_CORE_OPENAPI_URL",
      "https://api.voidhash.com/api/docs/openapi.json",
    ),
    eventCapture: resolveUrl("VOIDHASH_PRODUCTION_EVENT_CAPTURE_OPENAPI_URL"),
  },
};

const openapiDir = path.join(generatedClientsRoot, "openapi", mode);
mkdirSync(openapiDir, { recursive: true });

const fetchJson = async (url) => {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }

  return await response.text();
};

const run = (command, args) => {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: "pipe",
  });

  if (result.status !== 0) {
    process.stderr.write(result.stderr);
    process.stdout.write(result.stdout);
    process.exit(result.status ?? 1);
  }

  return result.stdout;
};

const main = async () => {
  const specUrls = specsByMode[mode];
  const corePath = path.join(openapiDir, "core.json");
  const eventCapturePath = path.join(openapiDir, "event-capture.json");

  writeFileSync(corePath, `${await fetchJson(specUrls.core)}\n`, "utf8");
  writeFileSync(eventCapturePath, `${await fetchJson(specUrls.eventCapture)}\n`, "utf8");

  const coreOutput = run("pnpm", [
    "dlx",
    "@tim-smart/openapi-gen@1.0.3",
    "--spec",
    corePath,
    "--name",
    "VoidhashCoreClient",
  ]);
  writeFileSync(path.join(generatedClientsRoot, "src/core/generated.ts"), coreOutput, "utf8");

  const eventCaptureOutput = run("pnpm", [
    "dlx",
    "@tim-smart/openapi-gen@1.0.3",
    "--spec",
    eventCapturePath,
    "--name",
    "VoidhashEventCaptureClient",
  ]);
  writeFileSync(
    path.join(generatedClientsRoot, "src/event-capture/generated.ts"),
    eventCaptureOutput,
    "utf8",
  );

  mkdirSync(nodeGeneratedRoot, { recursive: true });
  run("node", [
    "./scripts/generate-node-grouped-client.mjs",
    corePath,
    path.join(nodeGeneratedRoot, "grouped-client.ts"),
  ]);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
