import { GradientAvatar, Skeleton } from "@voidhash/ui";
import { DropdownMenu, DropdownMenuTrigger } from "@voidhash/ui";
import { getUser } from "@/lib/queries/cached-queries";
import { Suspense } from "react";
import { NavUserDropdown } from "./nav-user-dropdown";

function NavUserSkeleton() {
	return <Skeleton className="h-8 w-8 rounded-full" />;
}

export async function NavUserContent() {
	const user = await getUser();

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
