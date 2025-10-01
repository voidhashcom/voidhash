import { Prompt } from '@effect/cli';
import { Effect } from 'effect';
import { createProject } from './create-project';

export const selectProject = (
  organizationId: string,
  projects: ReadonlyArray<{ id: string; slug: string; name: string }>
) =>
  Effect.gen(function* () {
    const project = yield* Prompt.run(
      Prompt.select({
        message: 'Select a project',
        choices: [
          ...projects.map((p) => ({
            title: ` ·  ${p.name}`,
            value: p.slug
          })),
          { title: '(+) Create new project', value: 'create-new-project' }
        ]
      })
    );
    if (project === 'create-new-project') {
      return yield* createProject({ organizationId });
    }
    return project;
  });
