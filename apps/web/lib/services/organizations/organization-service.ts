import { Effect, pipe } from "effect";

import { createOrganization } from "./actions/create-organization";
import { deleteOrganization } from "./actions/delete-organization";
import { updateOrganization } from "./actions/update-organization";
import { AuthSession } from "@/lib/effect/auth";
import { OrganizationRepository } from "./organization-repository";
import { checkOrganizationPermission } from "@/lib/effect/permissions";


export class OrganizationService extends Effect.Service<OrganizationService>()(
	"OrganizationService",
	{
		effect: Effect.gen(function* () {
			return {
                createOrganization,
                getOrganizationBySlug: (slug: string) =>
                    pipe(
                        Effect.gen(function* () {
                            const session = yield* AuthSession;
                            const organizationRepository = yield* OrganizationRepository;
                            const organization = yield* organizationRepository.getOrganizationBySlug(slug);
                            if (!organization) {
                                return null;
                            }
                            // SECURITY: Authorization check
                            yield* checkOrganizationPermission(
                                organization.id,
                                "organization:all",
                                `User ${session?.user?.id} is not authorized to access organization ${organization.id}`
                            );
    
                            return organization;
                        }),
                        AuthSession.withAuthSession()
                    ),

                getOrganizationById: (id: string) =>
                    pipe(
                        Effect.gen(function* () {
                            const session = yield* AuthSession;
                            const organizationRepository = yield* OrganizationRepository;

                             // SECURITY: Authorization check
                             yield* checkOrganizationPermission(
                                id,
                                "organization:all",
                                `User ${session?.user?.id} is not authorized to access organization ${id}`
                            );

                            return yield* organizationRepository.getOrganizationById(id);
                        }),
                        AuthSession.withAuthSession()
                    ),

                deleteOrganization,
                updateOrganization
			};
		}),

		// Specify dependencies
		dependencies: [],
	}
) {}
