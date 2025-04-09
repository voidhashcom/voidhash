"use client";

import { BadgeCheck, CreditCard, LogOut } from "lucide-react";

import { Avatar, AvatarFallback, GradientAvatar, Skeleton } from "@voidhash/ui";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@voidhash/ui";
import { useSidebar } from "@voidhash/ui";
import { useMe } from "../auth/hooks/useMe";

export function NavUser({
	onSignOut,
}: {
	onSignOut: () => void;
}) {
	const { data: user, isLoading } = useMe();
	const { isMobile } = useSidebar();

	const userWithAvatar = user
		? {
				...user,
				avatar: user?.image ?? undefined,
			}
		: null;

	return (
		<div>
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<button className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground cursor-pointer">
						{isLoading ? (
							<Skeleton className="h-8 w-8 rounded-full" />
						) : userWithAvatar ? (
							<GradientAvatar
								className="h-8 w-8 rounded-lg"
								src={userWithAvatar.avatar}
								alt={userWithAvatar.name}
								fallback={userWithAvatar.id}
							/>
						) : null}
					</button>
				</DropdownMenuTrigger>
				{userWithAvatar && (
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
										src={userWithAvatar.avatar}
										alt={userWithAvatar.name}
										fallback={userWithAvatar.id}
									/>
									<AvatarFallback className="rounded-lg">CN</AvatarFallback>
								</Avatar>
								<div className="grid flex-1 text-left text-sm leading-tight">
									<span className="truncate font-semibold">
										{userWithAvatar.name}
									</span>
									<span className="truncate text-xs text-muted-foreground">
										{userWithAvatar.email}
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
							<button onClick={onSignOut} className="w-full">
								<LogOut />
								Log out
							</button>
						</DropdownMenuItem>
					</DropdownMenuContent>
				)}
			</DropdownMenu>
		</div>
	);
}
