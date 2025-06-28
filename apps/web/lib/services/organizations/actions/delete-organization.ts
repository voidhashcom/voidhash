import { AuthSession } from "@/lib/effect/auth";
import { Effect, pipe, Schema } from "effect";
import { checkOrganizationPermission } from "@/lib/effect/permissions";
import { BetterAuth } from "@/lib/effect/better-auth";
import { Request } from "@/lib/effect/request";

export const deleteOrganizationInputSchema = Schema.Struct({
	organizationId: Schema.String,
});

type DeleteOrganizationInput = Schema.Schema.Type<typeof deleteOrganizationInputSchema>;

export const deleteOrganization = (inputUnsafe: DeleteOrganizationInput) =>
	pipe(
		Effect.gen(function* () {
			const session = yield* AuthSession;
			const request = yield* Request;
			const input = Schema.decodeUnknownSync(deleteOrganizationInputSchema)(
				inputUnsafe
			);

			// SECURITY: Authorization check
			yield* checkOrganizationPermission(
				input.organizationId,
				"organization:all",
				`User ${session?.user?.id} is not authorized to delete organization ${input.organizationId}`
			);

			const betterAuth = yield* BetterAuth;
			yield* betterAuth.use(async (client) =>
				client.api.deleteOrganization({
					headers: yield* request.getHeaders(),
					body: { organizationId: input.organizationId },
				})
			);

			return yield* Effect.succeed(undefined);
		}),
		AuthSession.withAuthSession()
	);