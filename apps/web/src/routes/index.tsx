// app/routes/index.tsx
import * as fs from "node:fs";
import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { Button } from "@voidhash/ui/button";

export const Route = createFileRoute("/")({
	beforeLoad: async () => {
		throw redirect({ to: "/dashboard", replace: true });
	},
});
