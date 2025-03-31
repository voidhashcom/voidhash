import slugify from "slug";
import { auth } from "../../../auth/lib";
import ShortUniqueId from "short-unique-id";

const { randomUUID } = new ShortUniqueId({
	length: 10,
	dictionary: "alphanum_lower",
});

export type CreateOrganizationParams = {
	name: string;
};
export async function createOrganization(
	request: Request,
	{ name }: CreateOrganizationParams
) {
	let slug = slugify(name);
	try {
		await auth.api.checkOrganizationSlug({
			headers: request.headers,
			body: {
				slug,
			},
		});
	} catch (error) {
		if (error.body?.code === "SLUG_IS_TAKEN") {
			slug = slug + "-" + randomUUID();
		}
	}
	const organization = await auth.api.createOrganization({
		headers: request.headers,
		body: {
			name,
			slug,
		},
	});
	return organization;
}
