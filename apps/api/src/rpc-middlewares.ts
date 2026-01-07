import { eq, inArray, member, projects, user } from "@voidhash/db";
import { Db } from "@voidhash/db/effect";
import { AuthMiddleware } from "@voidhash/rpc";
import {
	AuthenticationError,
	NotAuthenticatedError,
	type UserSession,
} from "@voidhash/shared";
import { Effect, Layer, pipe } from "effect";
import { JwtAuth } from "./jwt-auth";

export const RpcAuthLive = Layer.effect(
	AuthMiddleware,
	// A middleware that provides the current user.
	//
	// You can access the headers, payload, and the RPC definition when
	// implementing the middleware.
	Effect.gen(function* () {
		const dbService = yield* Db;
		const jwtAuth = yield* JwtAuth;

		return AuthMiddleware.of(({ headers }) =>
			pipe(
				Effect.gen(function* () {
					// Extract Bearer token from Authorization header
					const token = yield* jwtAuth.extractBearerToken(
						headers.authorization,
					);

					// Validate the JWT and get the payload
					const payload = yield* jwtAuth.validateToken(token);

					const sub = payload.sub;
					if (!sub) {
						return yield* Effect.fail(
							new NotAuthenticatedError({
								message: "Invalid token: missing subject",
							}),
						);
					}

					// Fetch user's organizations from the database
					const usersOrganizations = yield* dbService.use(async (db) => {
						return await db.query.member.findMany({
							where: eq(member.userId, sub),
							with: {
								organization: true,
							},
						});
					});

					// Fetch user's projects based on organizations
					const usersProjects = yield* dbService.use(async (db) => {
						if (usersOrganizations.length === 0) {
							return [];
						}
						return await db.query.projects.findMany({
							where: inArray(
								projects.organizationId,
								usersOrganizations.map((m) => m.organization.id),
							),
						});
					});

					// Fetch the user from the database
					const dbUser = yield* dbService.use(async (db) => {
						return await db.query.user.findFirst({
							where: eq(user.id, sub),
						});
					});

					if (!dbUser) {
						return yield* Effect.fail(
							new NotAuthenticatedError({
								message: "User not found",
							}),
						);
					}

					return {
						method: "user",
						cookie: null,
						name: `${dbUser.name} <${dbUser.email}>`,
						user: {
							id: dbUser.id,
							name: dbUser.name,
							email: dbUser.email,
							emailVerified: dbUser.emailVerified,
							image: dbUser.image ?? null,
							createdAt: dbUser.createdAt,
							updatedAt: dbUser.updatedAt,
						},
						customer: null,
						organizations: usersOrganizations.map((m) => ({
							id: m.organization.id,
							slug: m.organization.slug ?? m.organization.id,
							name: m.organization.name,
							permissions: ["organization:all"], // TODO: Add permissions
						})),
						projects: usersProjects.map((p) => ({
							id: p.id,
							slug: p.slug,
							name: p.name,
							organizationId: p.organizationId,
							permissions: ["project:all"], // TODO: Add permissions
						})),
					} satisfies UserSession;
				}),
				Effect.catchTags({
					DatabaseError: (e) =>
						new AuthenticationError({
							message: "Failed to authenticate due to a database error",
							cause: String(e.message),
						}),
					JwtAuthError: (e) =>
						new AuthenticationError({
							message: "Failed to authenticate: invalid or expired token",
							cause: String(e.message),
						}),
				}),
			),
		);
	}),
);
