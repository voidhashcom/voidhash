import { Prompt } from "effect/unstable/cli";
import { Effect } from "effect";

import { createOrganization } from "./create-organization";

export const selectOrganization = (
  organizations: readonly { id: string; slug: string; name: string }[]
) =>
  Effect.gen(function* selectOrganization() {
    if (organizations.length === 0) {
      return yield* createOrganization();
    }
    const organizationSlug = yield* Prompt.run(
      Prompt.select({
        choices: [
          ...organizations.map((t) => ({
            title: ` ·  ${t.name}`,
            value: t.slug,
          })),
          {
            title: "(+) Create new organization",
            value: "create-new-organization",
          },
        ],
        message: "Select an organization",
      })
    );
    if (organizationSlug === "create-new-organization") {
      return yield* createOrganization();
    }
    const organization = organizations.find((t) => t.slug === organizationSlug);
    if (!organization) {
      return yield* Effect.die(
        "Organization not found even though it was selected and should exist."
      );
    }
    return organization;
  });
