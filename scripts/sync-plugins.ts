import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { findSkill } from "../apps/backend/src/ai/skills/registry.ts";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const targetPaths = [
  resolve(repositoryRoot, "integrations/claude-code/voidhash/skills/design-paywall/SKILL.md"),
  resolve(repositoryRoot, "plugins/voidhash/skills/design-paywall/SKILL.md"),
] as const;

const definition = findSkill("paywall-authoring");
if (definition === undefined) {
  throw new Error("The paywall-authoring skill is not registered");
}

const generated = `---
name: design-paywall
description: ${definition.description}
---

${definition.body().trimEnd()}
`;

const check = process.argv.includes("--check");
const stale: string[] = [];

for (const targetPath of targetPaths) {
  const current = await readFile(targetPath, "utf8").catch(() => undefined);
  if (current === generated) continue;
  if (check) {
    stale.push(targetPath);
  } else {
    await writeFile(targetPath, generated);
  }
}

if (stale.length > 0) {
  throw new Error(
    `Generated plugin skills are stale:\n${stale.join("\n")}\nRun pnpm sync:plugins.`,
  );
}
