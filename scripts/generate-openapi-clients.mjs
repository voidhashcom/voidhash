#!/usr/bin/env node

import { mkdirSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const generatedClientsRoot = path.join(repoRoot, "packages/generated-clients");
const nodeGeneratedRoot = path.join(repoRoot, "libraries/node/src/generated");
const openapiRoot = path.join(generatedClientsRoot, "openapi");

const rawHost = process.argv.slice(2).find((arg) => arg !== "--")?.trim();

if (!rawHost) {
  console.error(
    "Usage: node ./scripts/generate-openapi-clients.mjs <host>\nExample: node ./scripts/generate-openapi-clients.mjs localhost:8787",
  );
  process.exit(1);
}

const normalizeHost = (host) => {
  if (host.startsWith("http://") || host.startsWith("https://")) {
    return new URL(host).toString();
  }

  const protocol =
    host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http://" : "https://";

  return new URL(`${protocol}${host}`).toString();
};

const baseUrl = normalizeHost(rawHost);
const coreSpecUrl = new URL("/api/docs/openapi.json", baseUrl).toString();
const eventCaptureSpecUrl = new URL("/i/docs/openapi.json", baseUrl).toString();
const coreSpecPath = path.join(openapiRoot, "core.json");
const eventCaptureSpecPath = path.join(openapiRoot, "event-capture.json");

const fetchJson = async (url) => {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }

  return await response.text();
};

const assertCoreSpec = (spec) => {
  const paths = Object.keys(spec.paths ?? {});

  if (!paths.some((specPath) => specPath.startsWith("/api/v1/"))) {
    throw new Error("The core OpenAPI schema is missing /api/v1/* paths.");
  }
};

const assertEventCaptureSpec = (spec) => {
  const paths = Object.keys(spec.paths ?? {});

  if (!paths.includes("/i/v1/capture") || !paths.includes("/i/v1/batch")) {
    throw new Error("The event-capture OpenAPI schema is missing /i/v1/capture or /i/v1/batch.");
  }
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
  mkdirSync(openapiRoot, { recursive: true });

  const [coreSpecText, eventCaptureSpecText] = await Promise.all([
    fetchJson(coreSpecUrl),
    fetchJson(eventCaptureSpecUrl),
  ]);

  assertCoreSpec(JSON.parse(coreSpecText));
  assertEventCaptureSpec(JSON.parse(eventCaptureSpecText));

  writeFileSync(coreSpecPath, `${coreSpecText}\n`, "utf8");
  writeFileSync(eventCaptureSpecPath, `${eventCaptureSpecText}\n`, "utf8");

  const coreOutput = run("pnpm", [
    "dlx",
    "@tim-smart/openapi-gen@1.0.3",
    "--spec",
    coreSpecPath,
    "--name",
    "VoidhashCoreClient",
  ]);
  writeFileSync(path.join(generatedClientsRoot, "src/core/generated.ts"), coreOutput, "utf8");

  const eventCaptureOutput = run("pnpm", [
    "dlx",
    "@tim-smart/openapi-gen@1.0.3",
    "--spec",
    eventCaptureSpecPath,
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
    coreSpecPath,
    path.join(nodeGeneratedRoot, "grouped-client.ts"),
  ]);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
