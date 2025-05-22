import { getUser } from "@/lib/services/users/queries";
import { redirect } from "next/navigation";
import { createNextServiceContext } from "@/lib/nextjs/utils/create-next-service-context";
import { ErrorCard } from "@voidhash/ui";

export default async function Index() {
	const userRes = await getUser({
		ctx: await createNextServiceContext(),
	});

	if (userRes.isErr()) {
		const err = userRes._unsafeUnwrapErr();

		if (err.code === "NOT_FOUND" || err.code === "UNAUTHORIZED") {
			return redirect("/login");
		}

		return (
			<ErrorCard
				title="Something went wrong!"
				description="Please try again"
				onRetry={() => {
					window.location.reload();
				}}
			/>
		);
	}

	const user = userRes.value;

	if (user.organizations.length === 0) {
		return redirect("/~/create-organization");
	}
	return redirect(`/${user.organizations[0]!.slug}`);
}
