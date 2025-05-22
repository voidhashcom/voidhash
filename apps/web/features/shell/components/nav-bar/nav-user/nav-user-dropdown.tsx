"use client";

import {
	DropdownMenuContent,
	DropdownMenuLabel,
	Avatar,
	GradientAvatar,
	AvatarFallback,
	DropdownMenuSeparator,
	DropdownMenuItem,
	ToggleGroup,
	ToggleGroupItem,
} from "@voidhash/ui";
import { LogOut, Monitor, Moon, Sun } from "lucide-react";
import { authClient } from "@voidhash/auth/client";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { User } from "better-auth";

export function NavUserDropdown({
	user,
}: {
	user: User;
}) {
	const router = useRouter();

	const { setTheme, theme } = useTheme();

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
			{/* <DropdownMenuSeparator />

			<DropdownMenuGroup>
				<DropdownMenuItem>
					<BadgeCheck />
					Account
				</DropdownMenuItem>
				<DropdownMenuItem>
					<CreditCard />
					Billing
				</DropdownMenuItem>
			</DropdownMenuGroup> */}
			<DropdownMenuSeparator />
			<div className="flex gap-2 w-full justify-between p-2 items-center">
				<span className="text-sm text-muted-foreground ">Theme</span>
				<div>
					<ToggleGroup
						type="single"
						className="border border-border divide-x rounded-full overflow-hidden"
						value={theme}
						onValueChange={(value) => setTheme(value)}
					>
						<ToggleGroupItem
							value="system"
							aria-label="Toggle system"
							className="p-0 px-2 h-6"
						>
							<Monitor className="h-4 w-4" />
						</ToggleGroupItem>
						<ToggleGroupItem
							value="light"
							aria-label="Toggle light"
							className="p-0 px-2 h-6"
						>
							<Sun className="h-4 w-4" />
						</ToggleGroupItem>
						<ToggleGroupItem
							value="dark"
							aria-label="Toggle strikethrough"
							className="p-0 px-2 h-6"
						>
							<Moon className="h-4 w-4" />
						</ToggleGroupItem>
					</ToggleGroup>
				</div>
			</div>
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
