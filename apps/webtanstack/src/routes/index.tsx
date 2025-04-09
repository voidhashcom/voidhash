import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
	loader: async ({ context }) => {
		if (context.user) {
			if (context.user.organizations.length == 0) {
				throw redirect({
					to: "/create-org",
					replace: true,
				});
			}
			throw redirect({
				to: "/~/$organizationSlug",
				params: { organizationSlug: context.user.organizations[0].slug },
				replace: true,
			});
		}
		throw redirect({
			to: "/login",
			replace: true,
			search: { signup: false },
		});
	},
});
