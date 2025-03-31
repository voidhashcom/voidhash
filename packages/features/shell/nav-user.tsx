"use client";

import {
	BadgeCheck,
	Bell,
	ChevronsUpDown,
	CreditCard,
	LogOut,
	Sparkles,
} from "lucide-react";

import {
	Avatar,
	AvatarFallback,
	AvatarImage,
	GradientAvatar,
} from "@voidhash/ui";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@voidhash/ui";
import {
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	useSidebar,
} from "@voidhash/ui";

export function NavUser({
	user,
	onSignOut,
}: {
	user: {
		id: string;
		name: string;
		email: string;
		avatar?: string;
	};
	onSignOut: () => void;
}) {
	const { isMobile } = useSidebar();

	return (
		<div>
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<button className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground cursor-pointer">
						<GradientAvatar
							className="h-8 w-8 rounded-lg"
							src={user.avatar}
							alt={user.name}
							fallback={user.id}
						/>
					</button>
				</DropdownMenuTrigger>
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
									src={user.avatar}
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
						<button onClick={onSignOut} className="w-full">
							<LogOut />
							Log out
						</button>
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
		</div>
	);
}
