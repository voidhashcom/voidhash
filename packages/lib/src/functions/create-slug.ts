import slugify from "slug";

export function createSlug(name: string) {
	return slugify(name);
}
