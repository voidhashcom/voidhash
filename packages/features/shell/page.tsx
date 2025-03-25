import {
	SidebarTrigger,
	Separator,
	Breadcrumb,
	BreadcrumbList,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbSeparator,
	BreadcrumbPage,
	cn,
} from "@voidhash/ui";

export function Page({
	children,
	breadcrumbs,
	className,
}: React.ComponentProps<"div"> & {
	breadcrumbs?: {
		title: string;
		url: string;
	}[];
}) {
	return (
		<>
			<header className="flex h-16 shrink-0 items-center gap-2">
				<div className="flex items-center gap-2 px-4">
					<SidebarTrigger className="-ml-1" />
					{breadcrumbs && (
						<>
							<Separator orientation="vertical" className="mr-2 h-4" />
							<Breadcrumb>
								<BreadcrumbList>
									{breadcrumbs?.map((breadcrumb, index) => (
										<>
											{index < breadcrumbs.length - 1 && (
												<BreadcrumbItem className="hidden md:block">
													<BreadcrumbLink href={breadcrumb.url}>
														{breadcrumb.title}
													</BreadcrumbLink>
												</BreadcrumbItem>
											)}
											{index === breadcrumbs.length - 1 && (
												<BreadcrumbItem>
													<BreadcrumbPage>{breadcrumb.title}</BreadcrumbPage>
												</BreadcrumbItem>
											)}
											{index !== breadcrumbs.length - 1 && (
												<BreadcrumbSeparator className="hidden md:block" />
											)}
										</>
									))}
								</BreadcrumbList>
							</Breadcrumb>
						</>
					)}
				</div>
			</header>
			<div className={cn("p-4", className)}>{children}</div>
		</>
	);
}
