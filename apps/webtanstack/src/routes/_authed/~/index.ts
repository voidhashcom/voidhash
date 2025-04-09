import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authed/~/")({
	beforeLoad: async ({ context }) => {
		throw redirect({
			to: "/",
			replace: true,
			params: {},
		});
	},
});
