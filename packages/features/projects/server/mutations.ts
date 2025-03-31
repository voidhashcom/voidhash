import { createServerFn } from "@tanstack/react-start";
import { createProject } from "./actions/create-project";
import {
	createProjectSchema,
	deleteProjectSchema,
	updateProjectSchema,
} from "./schema";
import { authMiddleware } from "../../lib/middlewares/auth-middleware";
import { getWebRequest } from "@tanstack/react-start/server";
import { updateProject } from "./actions/update-organization";
import { deleteProject } from "./actions/delete-project";

export const createProjectMutation = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator((input) => createProjectSchema.parse(input))
	.handler(async ({ data, context }) => {
		const { name, organizationId } = data;
		const project = await createProject({
			name,
			organizationId,
			userId: context.user.id,
		});
		return project;
	});

export const updateProjectMutation = createServerFn({ method: "POST" })
	.validator((input) => updateProjectSchema.parse(input))
	.handler(async ({ data }) => {
		const { projectId, name } = data;
		const req = getWebRequest()!;
		await updateProject(req, {
			projectId,
			name,
		});
	});

export const deleteProjectMutation = createServerFn({ method: "POST" })
	.validator((input) => deleteProjectSchema.parse(input))
	.handler(async ({ data }) => {
		const { projectId } = data;
		const req = getWebRequest()!;
		await deleteProject({
			request: req,
			data: { projectId },
		});
	});
