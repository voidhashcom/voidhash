import { auth } from "../../../auth/lib";
export async function updateOrganization(
	request: Request,
	data: { organizationId: string; name: string }
) {
	const response = await auth.api.updateOrganization({
		headers: request.headers,
		body: {
			organizationId: data.organizationId,
			data: {
				name: data.name,
			},
		},
	});

	return response;
}
