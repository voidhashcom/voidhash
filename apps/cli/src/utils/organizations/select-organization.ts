import { Prompt } from '@effect/cli';
import { Effect } from 'effect';
import { createOrganization } from './create-organization';

export const selectOrganization = (
  organizations: ReadonlyArray<{ id: string; slug: string; name: string }>
) =>
  Effect.gen(function* () {
    const organizationSlug = yield* Prompt.run(
      Prompt.select({
        message: 'Select an organization',
        choices: [
          ...organizations.map((t) => ({
            title: ` ·  ${t.name}`,
            value: t.slug
          })),
          {
            title: '(+) Create new organization',
            value: 'create-new-organization'
          }
        ]
      })
    );
    if (organizationSlug === 'create-new-organization') {
      return yield* createOrganization();
    }
    const organization = organizations.find((t) => t.slug === organizationSlug);
    if (!organization) {
      return yield* Effect.dieMessage(
        'Organization not found even though it was selected and should exist.'
      );
    }
    return organization;
  });
