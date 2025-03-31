import { createFileRoute } from "@tanstack/react-router";
import {
	Avatar,
	AvatarFallback,
	Button,
	Card,
	CardContent,
	CardFooter,
	Checkbox,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
	Input,
	Label,
	Page,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
	Separator,
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@voidhash/ui";
import { DataTable } from "@voidhash/features/organizations/client/components/settings/data-table";
import { invitationsColumns } from "@voidhash/features/organizations/client/components/settings/pending-invites/columns";
import { LinkIcon, MoreHorizontal, Plus, Search, XIcon } from "lucide-react";
export const Route = createFileRoute(
	"/_authed/~/$organizationSlug/_organizations/settings/members"
)({
	component: RouteComponent,
});

function RouteComponent() {
	const handleCancelInvitation = () => {
		console.log("cancel invitation");
	};

	return (
		<Page
			breadcrumbs={[
				{ title: "Settings", url: "/settings" },
				{ title: "Team", url: "/settings/team" },
				{ title: "Members", url: "/settings/team/members" },
			]}
		>
			<div className="max-w-4xl mx-auto">
				<h1 className="text-3xl font-normal tracking-right">Members</h1>
				<p className="text-muted-foreground mt-3">
					Manage team members and invitations
				</p>
				<Card className="pb-0 overflow-hidden mt-8">
					<CardContent>
						<div className="flex justify-between items-center">
							<p className="text-muted-foreground">
								Invite new members by email address
							</p>
							<Button variant="outline" className="gap-2">
								<LinkIcon className="h-4 w-4" />
								Invite Link
							</Button>
						</div>

						<Separator className="my-6" />

						<div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
							<div>
								<Label htmlFor="email" className="mb-2">
									Email Address
								</Label>
								<Input id="email" placeholder="jack@example.com" />
							</div>
						</div>

						<div className="flex items-center justify-between mt-3">
							<div className="flex items-center gap-2">
								<Button variant="outline" size="sm" className="gap-1 ">
									<Plus className="h-4 w-4" />
									Add more
								</Button>
							</div>
						</div>
					</CardContent>
					<CardFooter className="bg-background py-3 border-t border-border [.border-t]:pt-3">
						<div className="ml-auto">
							<Button>Invite</Button>
						</div>
					</CardFooter>
				</Card>

				<Tabs defaultValue="members" className="w-full mt-6">
					<TabsList>
						<TabsTrigger value="members" className="cursor-pointer">
							Team Members
						</TabsTrigger>
						<TabsTrigger value="pending" className="cursor-pointer">
							Pending Invitations
						</TabsTrigger>
					</TabsList>

					<TabsContent value="members" className="pt-2">
						<Card className="p-0 gap-0">
							<div className="p-4 flex items-center gap-3">
								<Avatar className="h-8 w-8 bg-gradient-to-br from-purple-500 to-blue-500">
									<AvatarFallback>K</AvatarFallback>
								</Avatar>
								<div className="flex-1">
									<div className="font-medium">kingdoxik</div>
									<div className="text-sm text-gray-400">
										slipiklp@gmail.com
									</div>
								</div>
								<div className="text-muted-foreground mr-2">Owner</div>
								<DropdownMenu>
									<DropdownMenuTrigger asChild>
										<Button
											variant="outline"
											size="icon"
											className="h-8 w-8 cursor-pointer"
										>
											<MoreHorizontal className="h-4 w-4" />
										</Button>
									</DropdownMenuTrigger>
									<DropdownMenuContent align="end" className="min-w-54">
										<DropdownMenuItem variant="destructive">
											Leave team
										</DropdownMenuItem>
									</DropdownMenuContent>
								</DropdownMenu>
							</div>
						</Card>
					</TabsContent>

					<TabsContent value="pending">
						<div className="pt-6 text-center text-gray-400">
							No pending invitations
						</div>
					</TabsContent>
				</Tabs>
			</div>
		</Page>
	);
}
