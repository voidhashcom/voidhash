"use client";

import { AnyVoidhashError } from "@voidhash/lib/constants";
import { ErrorCard } from "@voidhash/ui";

export function VoidhashErrorCard({ error }: { error: AnyVoidhashError }) {
	console.error(error);
	// TODO: Improve this a lot
	return (
		<ErrorCard
			title="Something went wrong"
			description={
				error.code !== "INTERNAL_SERVER_ERROR"
					? error.message
					: "Please try again later"
			}
			className="h-screen"
			onRetry={() => {
				window.location.reload();
			}}
		/>
	);
}
