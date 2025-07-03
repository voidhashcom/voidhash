// Credits: Inspired by https://github.com/unkeyed/unkey

import { Client } from "@planetscale/database";
import { Database, eq, like } from "@voidhash/db";
import type { TaskContext } from "vitest";
import { drizzle as drizzleMysql } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { drizzle as drizzlePlanetscale } from "drizzle-orm/planetscale-serverless";
import * as schema from "@voidhash/db/schema";
import type {
	User,
	Organization,
	Project,
	ApiKey,
	PaymentProviderConfiguration,
	Transaction,
} from "@voidhash/db";
import { generateId } from "../id/generate";
import { env, integrationTestEnv } from "./env";
import { z } from "zod";
import { hashKey } from "../services/api-keys/utils";
import {
	stripe,
	stripePaymentProviderId,
} from "../payment-providers/stripe/stripe";
import {
	devCheckout,
	devCheckoutPaymentProviderId,
} from "../payment-providers/dev-checkout/dev-checkout";
import { Environment } from "@voidhash/lib/index";

export type Resources = {
	user: User;
	organization: Organization;
	project: Project;
	secretKey: ApiKey & { unhashedKey: string };
	publishableKey: ApiKey & { unhashedKey: string };
	devCheckoutPaymentProviderConfiguration: PaymentProviderConfiguration;
	paymentProviderConfiguration: PaymentProviderConfiguration;
};

export abstract class Harness {
	public db: { primary: Database; readonly: Database };
	public resources: Resources;
	private env: z.infer<typeof integrationTestEnv>;

	constructor(t: TaskContext) {
		this.env = env;
		t.onTestFinished(async () => {
			await this.teardown();
		});
	}

	protected async initHarness(): Promise<void> {
		const {
			DATABASE_HOST,
			DATABASE_PASSWORD,
			DATABASE_USERNAME,
			DATABASE_NAME,
		} = this.env;

		let db: Database;
		if (DATABASE_HOST.includes("psdb.cloud")) {
			const client = new Client({
				host: DATABASE_HOST,
				username: DATABASE_USERNAME,
				password: DATABASE_PASSWORD,
			});

			db = drizzlePlanetscale(client, { schema });
		} else {
			const connection = await mysql.createConnection({
				host: DATABASE_HOST,
				user: DATABASE_USERNAME,
				database: DATABASE_NAME,
				password: DATABASE_PASSWORD,
			});

			db = drizzleMysql({
				client: connection,
				schema,
				mode: "default",
			});
		}

		this.db = { primary: db, readonly: db };

		this.resources = await this.createResources();
	}

	private async teardown(): Promise<void> {
		const deleteResources = async () => {
			await this.db.primary.transaction(async (tx: Transaction) => {
				// Delete all previous test ids
				await tx.delete(schema.apiKeys).where(like(schema.apiKeys.id, "test%"));
				await tx
					.delete(schema.projects)
					.where(like(schema.projects.id, "test%"));
				await tx
					.delete(schema.organization)
					.where(like(schema.organization.id, "test%"));
				await tx.delete(schema.user).where(like(schema.user.id, "test%"));
				await tx
					.delete(schema.customers)
					.where(like(schema.customers.id, "test%"));
				await tx
					.delete(schema.purchases)
					.where(like(schema.purchases.id, "test%"));
				await tx
					.delete(schema.products)
					.where(like(schema.products.id, "test%"));
				await tx
					.delete(schema.paymentProviderConfigurationProducts)
					.where(like(schema.paymentProviderConfigurationProducts.id, "test%"));

				await tx
					.delete(schema.paymentProviderConfigurations)
					.where(like(schema.paymentProviderConfigurations.id, "test%"));
				await tx
					.delete(schema.productPerks)
					.where(like(schema.productPerks.id, "test%"));
				await tx.delete(schema.perks).where(like(schema.perks.id, "test%"));

				await tx
					.delete(schema.organization)
					.where(eq(schema.organization.id, this.resources.organization.id));

				await tx
					.delete(schema.user)
					.where(eq(schema.user.id, this.resources.user.id));
			});
		};
		for (let i = 1; i <= 5; i++) {
			try {
				await deleteResources();
				return;
			} catch (err) {
				if (i === 5) {
					throw err;
				}
				await new Promise((r) => setTimeout(r, i * 500));
			}
		}
	}

	public async createResources(): Promise<Resources> {
		const user: User = {
			id: generateId("test"),
			name: "Test User",
			email: `${generateId("test")}@test.com`,
			createdAt: new Date(),
			updatedAt: new Date(),
			emailVerified: true,
			image: null,
		};

		const organization: Organization = {
			id: generateId("test"),
			name: "Test Organization",
			slug: `${generateId("test")}-organization`,
			logo: null,
			createdAt: new Date(),
			metadata: null,
		};

		const project: Project = {
			id: generateId("test"),
			name: "Test Project",
			slug: `${generateId("test")}-project`,
			createdByUserId: user.id,
			createdAt: new Date(),
			updatedAt: new Date(),
			organizationId: organization.id,
		};

		const devCheckoutConfigurationId = generateId("test");
		const devCheckoutPaymentProviderConfiguration: PaymentProviderConfiguration =
			{
				id: devCheckoutConfigurationId,
				projectId: project.id,
				providerId: devCheckoutPaymentProviderId,
				name: "DevCheckout",
				enabled: true,
				paymentProviderKey: devCheckout.createGlobalKey({
					paymentProviderConfigurationId: devCheckoutConfigurationId,
				}),
				configuration: {},
				createdAt: new Date(),
				updatedAt: new Date(),
				deletedAt: null,
			};

		const paymentProviderConfiguration: PaymentProviderConfiguration = {
			id: generateId("test"),
			projectId: project.id,
			providerId: stripePaymentProviderId,
			name: "Stripe",
			enabled: true,
			paymentProviderKey: stripe.createGlobalKey({
				secretKey: "sk_test_123",
				webhookSecret: "whsec_123",
			}),
			configuration: {
				secretKey: "sk_test_123",
				webhookSecret: "whsec_123",
			} satisfies z.infer<
				ReturnType<typeof stripe.getGlobalConfigurationSchema>
			>,
			createdAt: new Date(),
			updatedAt: new Date(),
			deletedAt: null,
		};

		const unhashedKey = "test-secret-key";
		const hashedKey = await hashKey(unhashedKey);

		const secretKey: ApiKey & { unhashedKey: string } = {
			id: generateId("test"),
			name: "Test Secret Key",
			key: hashedKey,
			unhashedKey,
			createdAt: new Date(),
			updatedAt: new Date(),
			prefix: "test_",
			end: "1234",
			isPublic: false,
			environment: Environment.Production,
			projectId: project.id,
		};

		const testPublishableKey = "test-publishable-key";
		const publishableKey: ApiKey & { unhashedKey: string } = {
			id: generateId("test"),
			name: "Test Publishable Key",
			key: testPublishableKey,
			unhashedKey: testPublishableKey,
			createdAt: new Date(),
			updatedAt: new Date(),
			prefix: "test_",
			end: "1234",
			isPublic: true,
			environment: Environment.Production,
			projectId: project.id,
		};

		return {
			user,
			organization,
			project,
			secretKey,
			publishableKey,
			devCheckoutPaymentProviderConfiguration,
			paymentProviderConfiguration,
		};
	}

	protected async seed(): Promise<void> {
		await this.db.primary.insert(schema.user).values(this.resources.user);
		await this.db.primary
			.insert(schema.organization)
			.values(this.resources.organization);
		await this.db.primary
			.insert(schema.projects)
			.values(this.resources.project);
		await this.db.primary
			.insert(schema.apiKeys)
			.values(this.resources.secretKey);
		await this.db.primary
			.insert(schema.apiKeys)
			.values(this.resources.publishableKey);
		await this.db.primary
			.insert(schema.paymentProviderConfigurations)
			.values(this.resources.paymentProviderConfiguration);
		await this.db.primary
			.insert(schema.paymentProviderConfigurations)
			.values(this.resources.devCheckoutPaymentProviderConfiguration);
	}
}
