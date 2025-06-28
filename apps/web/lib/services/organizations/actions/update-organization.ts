import { AuthSession } from "@/lib/effect/auth";
import { Data, Effect, pipe, Schema } from "effect";
import { checkOrganizationPermission } from "@/lib/effect/permissions";
import { BetterAuth } from "@/lib/effect/better-auth";
import { Request } from "@/lib/effect/request";
import { OrganizationRepository } from "../organization-repository";

export class OrganizationNotFound extends Data.TaggedError("OrganizationNotFound")<{
	readonly cause?: unknown;
	readonly message: string;
}> {}

export const updateOrganizationInputSchema = Schema.Struct({
	organizationId: Schema.String,
	name: Schema.String,
});

type UpdateOrganizationInput = Schema.Schema.Type<typeof updateOrganizationInputSchema>;

export const updateOrganization = (inputUnsafe: UpdateOrganizationInput) =>
	pipe(
		Effect.gen(function* () {
			const session = yield* AuthSession;
			const request = yield* Request;
			const organizationRepository = yield* OrganizationRepository;
		
			const input = Schema.decodeUnknownSync(updateOrganizationInputSchema)(
				inputUnsafe
			);

			// SECURITY: Authorization check
			yield* checkOrganizationPermission(
				input.organizationId,
				"organization:all",
				`User ${session?.user?.id} is not authorized to update organization ${input.organizationId}`
			);

			const organization = yield* organizationRepository.getOrganizationById(input.organizationId);
			if (!organization) {
				return yield* Effect.fail(
					new OrganizationNotFound({
						message: `Organization with id ${input.organizationId} not found`,
					})
				);
			}

			const betterAuth = yield* BetterAuth;
			yield* betterAuth.use(async (client) =>
				client.api.updateOrganization({
					headers: yield* request.getHeaders(),
					body: {
						organizationId: input.organizationId,
						data: {
							name: input.name,
						},
					},
				})
			);

			return yield* Effect.succeed(undefined);
		}),
		AuthSession.withAuthSession()
	);