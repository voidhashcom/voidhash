import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { generateFiles } from "fumadocs-openapi";
import { createOpenAPI } from "fumadocs-openapi/server";

/**
 * Fetches the live OpenAPI documents from the backend and regenerates the API
 * Reference MDX pages. Point at a different backend with `VOIDHASH_API_URL`
 * (defaults to production); e.g. `VOIDHASH_API_URL=http://localhost:1337`.
 */
const API_URL = process.env.VOIDHASH_API_URL ?? "https://api.voidhash.com";

const appRoot = fileURLToPath(new URL("..", import.meta.url));
// Relative (to the app root) so the `document`/preload ids baked into generated
// pages are portable across machines rather than absolute local paths.
const specDirRel = "src/features/docs/openapi";
const specDir = path.join(appRoot, specDirRel);
const apiContentDir = path.join(appRoot, "src/features/docs/content/docs/api");

interface Surface {
  readonly label: string;
  /** Stable schema id embedded as `document` in generated pages (see mdx-components). */
  readonly key: string;
  readonly remotePath: string;
  readonly specFile: string;
  readonly output: string;
}

const surfaces: Surface[] = [
  {
    label: "Management & device SDK API",
    key: "voidhash-v1",
    remotePath: "/api/docs/openapi.json",
    specFile: "voidhash-v1.json",
    output: path.join(apiContentDir, "reference"),
  },
  {
    label: "Event Capture API",
    key: "event-capture",
    remotePath: "/i/docs/openapi.json",
    specFile: "event-capture.json",
    output: path.join(apiContentDir, "event-capture"),
  },
];

async function fetchSpec(surface: Surface): Promise<void> {
  const url = `${API_URL}${surface.remotePath}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }
  const document = await response.json();
  await writeFile(path.join(specDir, surface.specFile), `${JSON.stringify(document, null, 2)}\n`);
  console.log(`✓ fetched ${surface.label} (${url})`);
}

async function main(): Promise<void> {
  await mkdir(specDir, { recursive: true });
  for (const surface of surfaces) {
    await fetchSpec(surface);
  }

  for (const surface of surfaces) {
    await rm(surface.output, { force: true, recursive: true });
    // Keyed record input so generated pages reference the spec by a stable
    // `document` id (the key) rather than an absolute machine path.
    const server = createOpenAPI({
      input: { [surface.key]: `${specDirRel}/${surface.specFile}` },
    });
    await generateFiles({
      input: server,
      output: surface.output,
      per: "operation",
      groupBy: "tag",
      meta: true,
    });
    console.log(`✓ generated ${surface.label} -> ${path.relative(appRoot, surface.output)}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
