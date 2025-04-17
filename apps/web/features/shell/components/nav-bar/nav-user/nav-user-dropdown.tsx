"use client";

import {
	DropdownMenuContent,
	DropdownMenuLabel,
	Avatar,
	GradientAvatar,
	AvatarFallback,
	DropdownMenuSeparator,
	DropdownMenuGroup,
	DropdownMenuItem,
} from "@voidhash/ui";
import { BadgeCheck, CreditCard, LogOut } from "lucide-react";
import { getUser } from "@/lib/services/users/queries";
import { authClient } from "@voidhash/auth/client";
import { useRouter } from "next/navigation";

export function NavUserDropdown({
	user,
}: {
	user: NonNullable<Awaited<ReturnType<typeof getUser>>>;
}) {
	const router = useRouter();

	const handleSignOut = async () => {
		await authClient.signOut();
		router.refresh();
		router.push("/login");
	};

	return (
		<DropdownMenuContent
			className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
			side={"bottom"}
			align="end"
			sideOffset={4}
		>
			<DropdownMenuLabel className="p-0 font-normal">
				<div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
					<Avatar className="h-8 w-8 rounded-lg">
						<GradientAvatar
							className="h-8 w-8 rounded-lg"
							src={user.image ?? undefined}
							alt={user.name}
							fallback={user.id}
						/>
						<AvatarFallback className="rounded-lg">CN</AvatarFallback>
					</Avatar>
					<div className="grid flex-1 text-left text-sm leading-tight">
						<span className="truncate font-semibold">{user.name}</span>
						<span className="truncate text-xs text-muted-foreground">
							{user.email}
						</span>
					</div>
				</div>
			</DropdownMenuLabel>
			<DropdownMenuSeparator />

			<DropdownMenuGroup>
				<DropdownMenuItem>
					<BadgeCheck />
					Account
				</DropdownMenuItem>
				<DropdownMenuItem>
					<CreditCard />
					Billing
				</DropdownMenuItem>
			</DropdownMenuGroup>
			<DropdownMenuSeparator />
			<DropdownMenuItem asChild>
				<button onClick={handleSignOut} className="w-full">
					<LogOut />
					Log out
				</button>
			</DropdownMenuItem>
		</DropdownMenuContent>
	);
}
