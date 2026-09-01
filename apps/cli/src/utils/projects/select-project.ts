import { Prompt } from "effect/unstable/cli";
import * as Effect from "effect/Effect";

import { createProject } from "./create-project";
import * as Arr from "effect/Array";

export const selectProject = (
  organizationId: string,
  projects: readonly { id: string; slug: string; name: string }[],
) =>
  Effect.gen(function* selectProject() {
    if (Arr.isReadonlyArrayEmpty(projects)) {
      return yield* createProject({ organizationId });
    }
    const projectSlug = yield* Prompt.run(
      Prompt.select({
        choices: [
          ...projects.map((p) => ({
            title: ` ·  ${p.name}`,
            value: p.slug,
          })),
          { title: "(+) Create new project", value: "create-new-project" },
        ],
        message: "Select a project",
      }),
    );
    if (projectSlug === "create-new-project") {
      return yield* createProject({ organizationId });
    }

    const project = projects.find((p) => p.slug === projectSlug);
    if (!project) {
      return yield* Effect.die("Project not found even though it was selected and should exist.");
    }
    return project;
  });
