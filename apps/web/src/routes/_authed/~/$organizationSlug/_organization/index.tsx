import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute(
	"/_authed/~/$organizationSlug/_organization/"
)({
	beforeLoad: async ({ context, params }) => {
		throw redirect({
			to: "/~/$organizationSlug/projects",
			params: { organizationSlug: params.organizationSlug },
		});
	},
});
