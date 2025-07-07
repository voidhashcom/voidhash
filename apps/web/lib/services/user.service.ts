import { Effect } from "effect";
import { AuthSession } from "@/lib/services/auth.service";
import { BetterAuth } from "@/lib/effect/better-auth";
import { Request } from "@/lib/effect/request";
import { NotFoundError } from "@/lib/effect/errors";

export class UserService extends Effect.Service<UserService>()("UserService", {
	dependencies: [],
	effect: Effect.gen(function* () {
		return {
			getUser: () =>
				Effect.gen(function* () {
					const session = yield* AuthSession;
					const betterAuth = yield* BetterAuth;
					const request = yield* Request;

					const headers = yield* request.getHeaders;
					const organizations = yield* betterAuth.use(async (client) =>
						client.api.listOrganizations({
							headers,
						})
					);

					if (!session?.user) {
						return yield* Effect.fail(
							new NotFoundError({
								message: "User not found",
							})
						);
					}

					return {
						...session.user,
						organizations: organizations.map((o) => ({
							id: o.id,
							name: o.name,
							slug: o.slug,
							logo: o.logo ?? null,
							createdAt: o.createdAt,
							metadata: o.metadata ?? null,
						})),
					};
				}),
		};
	}),
}) {}
