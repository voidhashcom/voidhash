import { createFileRoute } from "@tanstack/react-router";
import {
	Avatar,
	AvatarFallback,
	Button,
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
	Input,
	Label,
	Page,
	Separator,
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@voidhash/ui";
import { LinkIcon, Plus, MoreHorizontal } from "lucide-react";

export const Route = createFileRoute(
	"/_authed/_dashboard/settings/team/general"
)({
	component: RouteComponent,
});

function RouteComponent() {
	return (
		<Page
			breadcrumbs={[
				{ title: "Settings", url: "/settings" },
				{ title: "Team", url: "/settings/team" },
				{ title: "Members", url: "/settings/team/members" },
			]}
		>
			<div className="max-w-4xl mx-auto">
				<Card className="pb-0 overflow-hidden">
					<CardHeader>
						<CardTitle>Team Name</CardTitle>
						<CardDescription>
							This is your team's visible name within Voidhash. For example, the
							name of your company or department.
						</CardDescription>
					</CardHeader>
					<CardContent>
						<Input className="max-w-64 text-foreground text-sm" />
					</CardContent>
					<CardFooter className="bg-background py-3 border-t border-border [.border-t]:pt-3 flex items-baseline justify-between">
						<div className="text-muted-foreground">
							Please use 32 characters at maximum.
						</div>
						<div>
							<Button>Save</Button>
						</div>
					</CardFooter>
				</Card>
				<Card className="pb-0 overflow-hidden mt-8">
					<CardHeader>
						<CardTitle>Team URL</CardTitle>
						<CardDescription>
							This is your team&apos;s URL namespace on voidhash. Within it,
							your team can inspect their projects, check out any recent
							activity, or configure settings to their liking.
						</CardDescription>
					</CardHeader>
					<CardContent>
						<Input className="max-w-64 text-foreground text-sm" />
					</CardContent>
					<CardFooter className="bg-background py-3 border-t border-border [.border-t]:pt-3 flex items-baseline justify-between">
						<div className="text-muted-foreground">
							Please use 48 characters at maximum.
						</div>
						<div>
							<Button>Save</Button>
						</div>
					</CardFooter>
				</Card>
			</div>
		</Page>
	);
}
