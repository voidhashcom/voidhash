import { AuthSession } from "@/lib/effect/auth";
import { checkOrganizationPermission } from "@/lib/effect/permissions";
import { Data, Effect, pipe, Schema } from "effect";
import { generateId } from "@/lib/id/generate";
import { ProjectRepository } from "../project.repository";
import { createSlug, createShortId } from "@voidhash/lib/functions";
import { SLUG_BLACKLIST } from "@voidhash/lib/constants";
import { randomUUID } from "crypto";
import { Environments } from "@/lib/services/environments/types";
import { ApiKeyRepository } from "@/lib/services/api-keys/api-key.repository";
import {
	devCheckout,
	devCheckoutPaymentProviderId,
} from "@/lib/payment-providers/dev-checkout/dev-checkout";
import { Db, TransactionContext } from "@/lib/effect/db";
import { UnauthenticatedError } from "@/lib/effect/errors";
import { paymentProviderConfigurations } from "@voidhash/db";
import { createPublishableKey } from "../../api-keys/effect/utils";

export class SlugAlreadyExistsError extends Data.TaggedError(
	"SlugAlreadyExistsError"
)<{
	readonly cause?: unknown;
	readonly message: string;
}> {}

export const createProjectInputSchema = Schema.Struct({
	name: Schema.String.pipe(Schema.minLength(1), Schema.maxLength(32)),
	organizationId: Schema.String,
});

type CreateProjectInput = Schema.Schema.Type<typeof createProjectInputSchema>;

export const createProject = (inputUnsafe: CreateProjectInput) =>
	pipe(
		Effect.gen(function* () {
			const session = yield* AuthSession;
			const projectRepository = yield* ProjectRepository;
			const apiKeyRepository = yield* ApiKeyRepository;
			const db = yield* Db;
			const input = Schema.decodeUnknownSync(createProjectInputSchema)(
				inputUnsafe
			);

			// SECURITY: Authorization check
			yield* checkOrganizationPermission(
				input.organizationId,
				"organization:all",
				`User ${session?.user?.id} is not authorized to create projects for organization ${input.organizationId}`
			);

			const userId = session?.user?.id;
			if (!userId) {
				return yield* Effect.fail(
					new UnauthenticatedError({
						message: "You are not authorized to create projects",
					})
				);
			}

			const id = generateId("project");
			let slug = createSlug(input.name);

			if (SLUG_BLACKLIST.includes(slug)) {
				slug = slug + "-" + createShortId();
			}

			const existingProject = yield* projectRepository.getProjectBySlug({
					projectSlug: slug,
					organizationId: input.organizationId,
				})

			if (existingProject) {
				slug = slug + "-" + randomUUID();
			}

			yield* db.transaction((tx) =>
				TransactionContext.provide(tx)(Effect.gen(function* () {
					yield* projectRepository.createProject({
						id,
						name: input.name,
						slug,
						organizationId: input.organizationId,
						createdByUserId: userId,
					});

					// Create production publishable key
					const productionPublishableKey = yield* createPublishableKey(
						Environments.Production
					);
					yield* apiKeyRepository.createApiKey({
						id: generateId("apiPublishableKey"),
						projectId: id,
						name: "Publishable key",
						...productionPublishableKey,
					});

					// Create testing publishable key
					const testingPublishableKey = yield* createPublishableKey(
						Environments.Testing
					);
					yield* apiKeyRepository.createApiKey({
						id: generateId("apiPublishableKeyTesting"),
						projectId: id,
						name: "Publishable key",
						...testingPublishableKey,
					});

					// Create dev checkout payment provider configuration using db directly since no repository exists
					const devCheckoutConfigurationId = generateId(
						"paymentProviderConfiguration"
					);
					yield* tx(async (dbTx) => {
						await dbTx.insert(paymentProviderConfigurations).values({
							id: devCheckoutConfigurationId,
							projectId: id,
							name: "Dev Checkout",
							providerId: devCheckoutPaymentProviderId,
							paymentProviderKey: devCheckout.createGlobalKey({
								paymentProviderConfigurationId: devCheckoutConfigurationId,
							}),
							enabled: true,
							configuration: {},
						});
					});
				}))
			);

			yield* Effect.log(
				`Created project ${id} for organization ${input.organizationId}`
			);

			return yield* Effect.succeed({
				id,
				slug,
			});
		}),
		AuthSession.withAuthSession()
	);
