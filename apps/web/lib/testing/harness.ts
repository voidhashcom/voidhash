// Credits: Inspired by https://github.com/unkeyed/unkey

import { Client } from "@planetscale/database";
import { Database, eq } from "@voidhash/db";
import type { TaskContext } from "vitest";
import { env } from "../env";
import { drizzle } from "drizzle-orm/planetscale-serverless";
import * as schema from "@voidhash/db/schema";
import type { User, Organization, Project, ApiKey } from "@voidhash/db";
import { generateId } from "../id/generate";

export type Resources = {
	user: User;
	organization: Organization;
	project: Project;
	secretKey: ApiKey;
};

export abstract class Harness {
	public readonly db: { primary: Database; readonly: Database };
	public resources: Resources;

	constructor(t: TaskContext) {
		const { DATABASE_HOST, DATABASE_PASSWORD, DATABASE_USERNAME } = env;
		const db = drizzle(
			new Client({
				host: DATABASE_HOST,
				username: DATABASE_USERNAME,
				password: DATABASE_PASSWORD,
				fetch: (url, init) => {
					const u = new URL(url);
					if (u.hostname === "planetscale" || u.host.includes("localhost")) {
						u.protocol = "http";
					}
					return fetch(u, init);
				},
			}),
			{
				schema,
			}
		);

		this.db = { primary: db, readonly: db };

		this.resources = this.createResources();

		t.onTestFinished(async () => {
			await this.teardown();
		});
	}

	private async teardown(): Promise<void> {
		const deleteResources = async () => {
			await this.db.primary.transaction(async (tx) => {
				await tx
					.delete(schema.apiKeys)
					.where(eq(schema.apiKeys.id, this.resources.secretKey.id));
				await tx
					.delete(schema.projects)
					.where(eq(schema.projects.id, this.resources.project.id));
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

	public createResources(): Resources {
		const user: User = {
			id: generateId("user"),
			name: "Test User",
			email: "test@test.com",
			createdAt: new Date(),
			updatedAt: new Date(),
			emailVerified: true,
			image: null,
		};

		const organization: Organization = {
			id: generateId("organization"),
			name: "Test Organization",
			slug: "test-organization",
			logo: null,
			createdAt: new Date(),
			metadata: null,
		};

		const project: Project = {
			id: generateId("project"),
			name: "Test Project",
			slug: "test-project",
			createdByUserId: user.id,
			createdAt: new Date(),
			updatedAt: new Date(),
			organizationId: organization.id,
		};

		const secretKey: ApiKey = {
			id: generateId("apiSecretKey"),
			name: "Test Secret Key",
			key: "test-secret-key",
			createdAt: new Date(),
			updatedAt: new Date(),
			prefix: "test_",
			end: "1234",
			isPublic: false,
			environment: "production",
			projectId: project.id,
		};

		return {
			user,
			organization,
			project,
			secretKey,
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
	}
}
