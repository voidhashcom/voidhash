import { AuthSession } from "@/lib/effect/auth";
import { Data, Effect, Either, pipe, Schema } from "effect";
import { createShortId, createSlug } from "@voidhash/lib/functions";
import { SLUG_BLACKLIST } from "@voidhash/lib/constants";
import { BetterAuth } from "@/lib/effect/better-auth";
import { Request } from "@/lib/effect/request";

export class FailedToCreateOrganizationError extends Data.TaggedError(
	"FailedToCreateOrganizationError"
)<{
	readonly cause?: unknown;
	readonly message: string;
}> {}

export class UserSessionNotFoundError extends Data.TaggedError(
	"UserSessionNotFoundError"
)<{
	readonly message: string;
}> {}

export const createOrganizationInputSchema = Schema.Struct({
	name: Schema.String.pipe(Schema.minLength(3), Schema.maxLength(32)),
});

type CreateOrganizationInput = Schema.Schema.Type<typeof createOrganizationInputSchema>;

export const createOrganization = (inputUnsafe: CreateOrganizationInput) =>
	pipe(
		Effect.gen(function* () {
			const betterAuth = yield* BetterAuth;
			const request = yield* Request;
			const session = yield* AuthSession;
			const input = Schema.decodeUnknownSync(createOrganizationInputSchema)(
				inputUnsafe
			);
			let slug = createSlug(input.name);
			if (SLUG_BLACKLIST.includes(slug)) {
				slug = slug + "-" + createShortId();
			}

			const slugIsAvailable = yield* checkSlugAvailable(slug);
			if (!slugIsAvailable) {
				slug = slug + "-" + createShortId();
			}

			const organization = yield* betterAuth.use(async (client) =>
				client.api.createOrganization({
					headers: yield* request.getHeaders(),
					body: {
						name: input.name,
						slug,
					},
				})
			);
			if (!organization) {
				return yield* Effect.fail(
					new FailedToCreateOrganizationError({
						message: "Failed to create organization",
					})
				);
			}

			const email = session?.user?.email;
			if (!email) {
				return yield* Effect.fail(
					new UserSessionNotFoundError({
						message: "User session not found",
					})
				);
			}

			return yield* Effect.succeed({
				id: organization.id,
				name: organization.name,
				slug,
			});

		}),
		AuthSession.withAuthSession()
	);


const checkSlugAvailable = (slug: string) =>
	pipe(
		Effect.gen(function* () {
			const betterAuth = yield* BetterAuth;
			const request = yield* Request;
			const res = yield* Effect.either(betterAuth.use(async (client) =>
				client.api.checkOrganizationSlug({
					headers: yield* request.getHeaders(),
					body: { slug },
				})
			));

			if (Either.isLeft(res)) {
				const error = res.left;
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				if (error.cause && error.cause && (error.cause as any).body?.code === "SLUG_IS_TAKEN") {
					return yield* Effect.succeed(false);
				}
				return yield* Effect.fail(res.left);
			}

			return yield* Effect.succeed(true);
		})
	);