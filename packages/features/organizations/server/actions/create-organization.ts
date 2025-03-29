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
	const slug = slugify(name) + "-" + randomUUID();
	const organization = await auth.api.createOrganization({
		headers: request.headers,
		body: {
			name,
			slug,
		},
	});
	return organization;
}
