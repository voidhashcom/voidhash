"use server";

import { actionClient } from "@/lib/safe-action";
import {
	createOrganizationInputSchema,
	createOrganization,
} from "../services/organizations/create-organization";
import {
	deleteOrganizationInputSchema,
	deleteOrganization,
} from "../services/organizations/delete-organization";
import {
	updateOrganizationInputSchema,
	updateOrganization,
} from "../services/organizations/update-organization";
import {
	createProject,
	createProjectInputSchema,
} from "../services/projects/create-project";
import {
	deleteProject,
	deleteProjectInputSchema,
} from "../services/projects/delete-project";
import {
	updateProject,
	updateProjectInputSchema,
} from "../services/projects/update-project";
import {
	rotateSecretKey,
	rotateSecretKeyInputSchema,
} from "../services/api-keys/rotate-secret-key";
import {
	createSecretKey,
	createSecretKeyInputSchema,
} from "../services/api-keys/create-secret-key";
import {
	deleteSecretKey,
	deleteSecretKeyInputSchema,
} from "../services/api-keys/delete-secret-key";
import {
	switchEnvironment,
	switchEnvironmentInputSchema,
} from "../services/environments/switch-environment";
import {
	createProduct,
	createProductInputSchema,
} from "../services/products/create-product";

// Api keys
export const createSecretKeyAction = actionClient
	.schema(createSecretKeyInputSchema)
	.action(async ({ parsedInput, ctx }) => {
		return await createSecretKey({
			ctx: ctx.serviceContext,
			input: parsedInput,
		});
	});

export const createProductAction = actionClient
	.schema(createProductInputSchema)
	.action(async ({ parsedInput, ctx }) => {
		return await createProduct({
			ctx: ctx.serviceContext,
			input: parsedInput,
		});
	});

export const rotateSecretKeyAction = actionClient
	.schema(rotateSecretKeyInputSchema)
	.action(async ({ parsedInput, ctx }) => {
		return await rotateSecretKey({
			ctx: ctx.serviceContext,
			input: parsedInput,
		});
	});

export const deleteSecretKeyAction = actionClient
	.schema(deleteSecretKeyInputSchema)
	.action(async ({ parsedInput, ctx }) => {
		return await deleteSecretKey({
			ctx: ctx.serviceContext,
			input: parsedInput,
		});
	});

// Organization
export const createOrganizationAction = actionClient
	.schema(createOrganizationInputSchema)
	.action(async ({ parsedInput, ctx }) => {
		return await createOrganization({
			ctx: ctx.serviceContext,
			input: parsedInput,
		});
	});

export const updateOrganizationAction = actionClient
	.schema(updateOrganizationInputSchema)
	.action(async ({ parsedInput, ctx }) => {
		return await updateOrganization({
			ctx: ctx.serviceContext,
			input: parsedInput,
		});
	});

export const deleteOrganizationAction = actionClient
	.schema(deleteOrganizationInputSchema)
	.action(async ({ parsedInput, ctx }) => {
		return await deleteOrganization({
			ctx: ctx.serviceContext,
			input: parsedInput,
		});
	});

// Project
export const createProjectAction = actionClient
	.schema(createProjectInputSchema)
	.action(async ({ parsedInput, ctx }) => {
		return await createProject({
			ctx: ctx.serviceContext,
			input: parsedInput,
		});
	});

export const updateProjectAction = actionClient
	.schema(updateProjectInputSchema)
	.action(async ({ parsedInput, ctx }) => {
		return await updateProject({
			ctx: ctx.serviceContext,
			input: parsedInput,
		});
	});

export const deleteProjectAction = actionClient
	.schema(deleteProjectInputSchema)
	.action(async ({ parsedInput, ctx }) => {
		return await deleteProject({
			ctx: ctx.serviceContext,
			input: parsedInput,
		});
	});

// Environment
export const switchEnvironmentAction = actionClient
	.schema(switchEnvironmentInputSchema)
	.action(async ({ parsedInput, ctx }) => {
		return await switchEnvironment({
			ctx: ctx.serviceContext,
			input: parsedInput,
		});
	});
