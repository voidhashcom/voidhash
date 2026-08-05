import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { findSkill } from "../packages/backend/src/ai/skills/registry.ts";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const skills = [
  { sourceName: "paywall-authoring", pluginName: "design-paywall" },
  { sourceName: "code-component-authoring", pluginName: "code-component-authoring" },
] as const;

const check = process.argv.includes("--check");
const stale: string[] = [];

for (const skill of skills) {
  const definition = findSkill(skill.sourceName);
  if (definition === undefined) {
    throw new Error(`The ${skill.sourceName} skill is not registered`);
  }
  const generated = `---
name: ${skill.pluginName}
description: ${definition.description}
---

${definition.body().trimEnd()}
`;
  const targetPaths = [
    resolve(
      repositoryRoot,
      `integrations/claude-code/voidhash/skills/${skill.pluginName}/SKILL.md`,
    ),
    resolve(repositoryRoot, `plugins/voidhash/skills/${skill.pluginName}/SKILL.md`),
  ];

  for (const targetPath of targetPaths) {
    const current = await readFile(targetPath, "utf8").catch(() => undefined);
    if (current === generated) continue;
    if (check) {
      stale.push(targetPath);
    } else {
      await writeFile(targetPath, generated);
    }
  }
}

if (stale.length > 0) {
  throw new Error(
    `Generated plugin skills are stale:\n${stale.join("\n")}\nRun pnpm sync:plugins.`,
  );
}
