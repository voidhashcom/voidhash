import { Page } from "@voidhash/ui";
import { Content } from "./content";
import { HydrateClient, trpc, prefetch } from "@voidhash/features/trpc/server";

export default async function RouteComponent() {
	void prefetch(trpc.auth.me.queryOptions());
	return (
		<HydrateClient>
			<Page>
				<Content />
			</Page>
		</HydrateClient>
	);
}
