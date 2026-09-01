import { Prompt } from "effect/unstable/cli";
import * as Effect from "effect/Effect";

import { createOrganization } from "./create-organization";
import * as Arr from "effect/Array";

export const selectOrganization = (
  organizations: readonly { id: string; slug: string; name: string }[],
) =>
  Effect.gen(function* selectOrganization() {
    if (Arr.isReadonlyArrayEmpty(organizations)) {
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
      }),
    );
    if (organizationSlug === "create-new-organization") {
      return yield* createOrganization();
    }
    const organization = organizations.find((t) => t.slug === organizationSlug);
    if (!organization) {
      return yield* Effect.die(
        "Organization not found even though it was selected and should exist.",
      );
    }
    return organization;
  });
