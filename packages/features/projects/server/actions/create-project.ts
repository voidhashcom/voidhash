import slugify from "slug";
import { db, projects } from "@voidhash/db";
import ShortUniqueId from "short-unique-id";
import { createId } from "@paralleldrive/cuid2";
import { and, eq } from "drizzle-orm";
import { ConflictError, VoidhashError } from "../../../lib/errors";

const { randomUUID } = new ShortUniqueId({
	length: 10,
	dictionary: "alphanum_lower",
});

type CreateProjectParams = {
	name: string;
	organizationId: string;
	userId: string;
};

export async function createProject(input: CreateProjectParams) {
	const { name, organizationId, userId } = input;
	const id = createId();
	let slug = slugify(name);

	const existingProject = await db.query.projects.findFirst({
		where: and(
			eq(projects.slug, slug),
			eq(projects.organizationId, organizationId)
		),
	});

	if (existingProject) {
		slug = slug + "-" + randomUUID();
	}

	await db.insert(projects).values({
		id,
		name,
		slug,
		organizationId,
		createdByUserId: userId,
	});

	return {
		id,
		name,
		slug,
	};
}
