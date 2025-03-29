import * as React from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";

import {
	Button,
	Popover,
	PopoverContent,
	PopoverTrigger,
	GradientAvatar,
	useSidebar,
} from "@voidhash/ui";
import {
	Link,
	useLocation,
	useParams,
	useRouter,
	useRouterState,
} from "@tanstack/react-router";
import { CreateOrganizationModal } from "../organizations/components/create-organization-modal";

export function OrganizationProjectSwitcher({
	organizations,
	activeOrganization,
	activeProject,
}: {
	activeOrganization: {
		id: string;
		name: string;
		logo: React.ElementType;
	};
	activeProject?: {
		id: string;
		name: string;
		logo: React.ElementType;
	};
	organizations: {
		id: string;
		slug: string;
		name: string;
		logo: React.ElementType;
		plan: string;
		projects: {
			id: string;
			name: string;
			logo: React.ElementType;
		}[];
	}[];
}) {
	const router = useRouter();
	const routerState = useRouterState();

	const [highlightedOrganizationIndex, setHighlightedOrganizationIndex] =
		React.useState(0);

	const highlightedOrganizationProjects = organizations[
		highlightedOrganizationIndex
	].projects.map((project) => ({
		...project,
		logo: project.logo,
	}));

	const [createOrganizationModalOpen, setCreateOrganizationModalOpen] =
		React.useState(false);

	const handleOrganizationSelect = (
		organization: (typeof organizations)[0]
	) => {
		router.navigate({
			params: {
				// @ts-ignore
				organizationSlug: organization.slug,
			},
		});
	};

	const handleProjectSelect = (
		project: (typeof highlightedOrganizationProjects)[0]
	) => {};

	return (
		<Popover>
			<PopoverTrigger asChild>
				<Button
					size={"icon"}
					variant={"ghost"}
					className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground focus-visible:ring-0 px-1"
				>
					<ChevronsUpDown className="text-muted-foreground" />
				</Button>
			</PopoverTrigger>
			<PopoverContent
				className="w-[--radix-popover-trigger-width] min-w-56 rounded-lg p-0"
				align="start"
				side={"bottom"}
				sideOffset={4}
			>
				<div className="flex flex-row divide-x divide-border">
					<div className="w-56">
						<div className="px-2 py-1.5 text-xs text-muted-foreground">
							Teams
						</div>
						{organizations.map((organization, index) => (
							<Link
								key={organization.name}
								from={routerState.location.pathname}
								// @ts-expect-error - TODO: fix this
								params={(prev) => ({
									...prev,
									organizationSlug: organization.slug,
								})}
								onMouseEnter={() => setHighlightedOrganizationIndex(index)}
								className="flex w-full items-center gap-2 p-2 hover:bg-accent text-foreground hover:text-accent-foreground text-sm"
							>
								<GradientAvatar
									className="h-6 w-6 rounded-lg text-xs"
									src={undefined}
									alt={organization.name}
									fallback={organization.id}
								/>
								{organization.name}
								{organization.id === activeOrganization.id && (
									<Check className="ml-auto h-4 w-4" />
								)}
							</Link>
						))}
						<div className="h-px bg-border" />
						<CreateOrganizationModal
							open={createOrganizationModalOpen}
							onClose={() => setCreateOrganizationModalOpen(false)}
							trigger={
								<button
									onClick={() => setCreateOrganizationModalOpen(true)}
									className="flex w-full items-center gap-2 p-2 hover:bg-accent hover:text-accent-foreground"
								>
									<div className="flex size-6 items-center justify-center rounded-md border bg-background">
										<Plus className="size-4 text-muted-foreground" />
									</div>
									<div className=" text-sm">Add team</div>
								</button>
							}
						/>
					</div>
					<div className="w-56">
						<div className="px-2 py-1.5 text-xs text-muted-foreground">
							Projects
						</div>
						{highlightedOrganizationProjects.map((project, index) => (
							<button
								key={project.name}
								onClick={() => handleProjectSelect(project)}
								className="flex w-full items-center gap-2 p-2 hover:bg-accent text-foreground hover:text-accent-foreground text-sm"
							>
								{project.name}
								{project.id === activeProject?.id && (
									<Check className="ml-auto h-4 w-4" />
								)}
							</button>
						))}
						<div className="h-px bg-border" />
						<button className="flex w-full items-center gap-2 p-2 hover:bg-accent hover:text-accent-foreground">
							<div className="flex size-6 items-center justify-center rounded-md border bg-background">
								<Plus className="size-4 text-muted-foreground" />
							</div>
							<div className="text-sm">Add project</div>
						</button>
					</div>
				</div>
			</PopoverContent>
		</Popover>
	);
}
