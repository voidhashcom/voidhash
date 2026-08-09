import { NodeRuntime, NodeServices } from "@effect/platform-node";
import { Data, Effect, FileSystem, Path, Stdio } from "effect";

import { findSkill } from "../packages/backend/src/ai/skills/registry.ts";
import { constant } from "../packages/lib/src/lang/index.ts";

class SyncPluginsError extends Data.TaggedError("SyncPluginsError")<{
  readonly message: string;
}> {}

const skills = constant([
  { sourceName: "paywall-authoring", pluginName: "design-paywall" },
  { sourceName: "code-component-authoring", pluginName: "code-component-authoring" },
]);

const program = Effect.gen(function* () {
  const fileSystem = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const stdio = yield* Stdio.Stdio;

  const scriptPath = yield* path.fromFileUrl(new URL(import.meta.url));
  const repositoryRoot = path.resolve(path.dirname(scriptPath), "..");

  const args = yield* stdio.args;
  const check = args.includes("--check");
  const stale: string[] = [];

  for (const skill of skills) {
    const definition = findSkill(skill.sourceName);
    if (definition === undefined) {
      return yield* new SyncPluginsError({
        message: `The ${skill.sourceName} skill is not registered`,
      });
    }
    const generated = `---
name: ${skill.pluginName}
description: ${definition.description}
---

${definition.body().trimEnd()}
`;
    const targetPaths = [
      path.resolve(
        repositoryRoot,
        `integrations/claude-code/voidhash/skills/${skill.pluginName}/SKILL.md`,
      ),
      path.resolve(repositoryRoot, `plugins/voidhash/skills/${skill.pluginName}/SKILL.md`),
    ];

    for (const targetPath of targetPaths) {
      const current = yield* fileSystem
        .readFileString(targetPath, "utf8")
        .pipe(Effect.orElseSucceed(() => undefined));
      if (current === generated) continue;
      if (check) {
        stale.push(targetPath);
        continue;
      }
      yield* fileSystem.writeFileString(targetPath, generated);
    }
  }

  if (stale.length > 0) {
    return yield* new SyncPluginsError({
      message: `Generated plugin skills are stale:\n${stale.join("\n")}\nRun pnpm sync:plugins.`,
    });
  }
});

NodeRuntime.runMain(program.pipe(Effect.provide(NodeServices.layer)));
