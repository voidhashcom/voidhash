import { redirect } from "next/navigation";
import { ErrorCard } from "@voidhash/ui";
import { runServerEffect } from "@/lib/effect/runtimes/nextjs";
import { Effect } from "effect";
import { UserService } from "@/lib/services/user.service";

export default async function Index() {
	const data = await runServerEffect(Effect.gen(function* () {
		const userService = yield* UserService;
		const user = yield* userService.getUser();
		return { user };
	}));

	if (data.isErr()) {
		const err = data._unsafeUnwrapErr();

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

	const { user } = data.value;

	if (user.organizations.length === 0) {
		return redirect("/~/create-organization");
	}
	return redirect(`/${user.organizations[0]!.slug}`);
}
