import { Effect } from "effect";

import { BetterAuth } from "../../better-auth/better-auth-effect";
import { BillingService } from "../billing";
import { createOrganization } from "./create-organization";
import { deleteOrganization } from "./delete-organization";
import { getOrganizationById } from "./get-organization-by-id";
import { getOrganizationBySlug } from "./get-organization-by-slug";
import { updateOrganization } from "./update-organization";

export class OrganizationService extends Effect.Service<OrganizationService>()(
  "OrganizationService",
  {
    // Specify dependencies
    dependencies: [BetterAuth.Default, BillingService.Default],
    effect: Effect.gen(function* effect() {
      return {
        createOrganization: yield* createOrganization,
        deleteOrganization: yield* deleteOrganization,
        getOrganizationById: yield* getOrganizationById,
        getOrganizationBySlug: yield* getOrganizationBySlug,
        updateOrganization: yield* updateOrganization,
      } as const;
    }),
  }
) {}
