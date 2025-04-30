// Credits: Inspired by https://github.com/unkeyed/unkey

import { Client } from "@planetscale/database";
import { Database, eq } from "@voidhash/db";
import type { TaskContext } from "vitest";
import { drizzle as drizzleMysql } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { drizzle as drizzlePlanetscale } from "drizzle-orm/planetscale-serverless";
import * as schema from "@voidhash/db/schema";
import type { User, Organization, Project, ApiKey } from "@voidhash/db";
import { generateId } from "../id/generate";
import { env, integrationTestEnv } from "./env";
import { z } from "zod";
import { hashKey } from "../services/api-keys/utils";

export type Resources = {
	user: User;
	organization: Organization;
	project: Project;
	secretKey: ApiKey & { unhashedKey: string };
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

	public async createResources(): Promise<Resources> {
		const user: User = {
			id: generateId("test"),
			name: "Test User",
			email: "test@test.com",
			createdAt: new Date(),
			updatedAt: new Date(),
			emailVerified: true,
			image: null,
		};

		const organization: Organization = {
			id: generateId("test"),
			name: "Test Organization",
			slug: "test-organization",
			logo: null,
			createdAt: new Date(),
			metadata: null,
		};

		const project: Project = {
			id: generateId("test"),
			name: "Test Project",
			slug: "test-project",
			createdByUserId: user.id,
			createdAt: new Date(),
			updatedAt: new Date(),
			organizationId: organization.id,
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
