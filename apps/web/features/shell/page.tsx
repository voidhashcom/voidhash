import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
	cn,
	Separator,
	Skeleton,
} from "@voidhash/ui";
import { Fragment } from "react";

export function Page({
	children,
	breadcrumbs,
	className,
}: React.ComponentProps<"div"> & {
	breadcrumbs?: {
		title: string;
		url?: string;
		isLoading?: boolean;
	}[];
}) {
	return (
		<>
			<header className="flex h-16 shrink-0 items-center gap-2">
				<div className="flex items-center gap-2 px-4">
					{breadcrumbs && (
						<>
							<Separator orientation="vertical" className="mr-2 h-4" />
							<Breadcrumb>
								<BreadcrumbList>
									{breadcrumbs?.map((breadcrumb, index) => (
										<Fragment key={breadcrumb.url ?? breadcrumb.title}>
											{index < breadcrumbs.length - 1 && (
												<BreadcrumbItem className="hidden md:block">
													<BreadcrumbLink href={breadcrumb.url}>
														{breadcrumb.title}
													</BreadcrumbLink>
												</BreadcrumbItem>
											)}
											{index === breadcrumbs.length - 1 && (
												<BreadcrumbItem>
													<BreadcrumbPage>
														{breadcrumb.isLoading ? (
															<Skeleton className="w-20 h-4" />
														) : (
															breadcrumb.title
														)}
													</BreadcrumbPage>
												</BreadcrumbItem>
											)}
											{index !== breadcrumbs.length - 1 && (
												<BreadcrumbSeparator className="hidden md:block" />
											)}
										</Fragment>
									))}
								</BreadcrumbList>
							</Breadcrumb>
						</>
					)}
				</div>
			</header>
			<div className={cn("p-4 py-8", className)}>{children}</div>
		</>
	);
}
