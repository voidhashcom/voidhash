import { getWebRequest } from "@tanstack/react-start/server";
import { auth } from "../../../auth/lib";

export async function deleteOrganization({
	request,
	data,
}: {
	request: Request;
	data: { organizationId: string };
}) {
	const response = await auth.api.deleteOrganization({
		headers: request.headers,
		body: {
			organizationId: data.organizationId,
		},
	});

	return response;
}
