import { createServerFn } from "@tanstack/react-start";
import { createOrganization } from "./actions/create-organization";
import { z } from "zod";
import { getWebRequest } from "@tanstack/react-start/server";
import { createOrganizationSchema, updateOrganizationSchema } from "./schema";
import { updateOrganization } from "./actions/update-organization";

export const createOrganizationMutation = createServerFn({ method: "POST" })
	.validator((input) => createOrganizationSchema.parse(input))
	.handler(async ({ data }) => {
		const { name } = data;
		const req = getWebRequest()!;
		const organization = await createOrganization(req, { name });
		return organization;
	});

export const updateOrganizationMutation = createServerFn({ method: "POST" })
	.validator((input) => updateOrganizationSchema.parse(input))
	.handler(async ({ data }) => {
		const { organizationId, name } = data;
		const req = getWebRequest()!;
		const organization = await updateOrganization(req, {
			organizationId,
			name,
		});
		return organization;
	});
