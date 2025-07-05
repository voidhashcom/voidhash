import { GradientAvatar, Skeleton } from "@voidhash/ui";
import { DropdownMenu, DropdownMenuTrigger } from "@voidhash/ui";
import { Suspense } from "react";
import { NavUserDropdown } from "./nav-user-dropdown";
import { runServerEffect } from "@/lib/effect/runtimes/nextjs";
import { UserService } from "@/lib/services/user.service";
import { Effect } from "effect";

function NavUserSkeleton() {
	return <Skeleton className="h-8 w-8 rounded-full" />;
}

export async function NavUserContent() {
	const data = await runServerEffect(Effect.gen(function* () {
		const userService = yield* UserService;
		const user = yield* userService.getUser();
		return { user };
	}));

	if (data.isErr()) {
		return <div>Error loading user</div>;
	}

	const { user } = data.value;

	return (
		<div>
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<button className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground cursor-pointer">
						{user && (
							<GradientAvatar
								className="h-8 w-8 rounded-lg"
								src={user.image ?? undefined}
								alt={user.name}
								fallback={user.id}
							/>
						)}
					</button>
				</DropdownMenuTrigger>
				{user && <NavUserDropdown user={user} />}
			</DropdownMenu>
		</div>
	);
}

export async function NavUser() {
	return (
		<Suspense fallback={<NavUserSkeleton />}>
			<NavUserContent />
		</Suspense>
	);
}
