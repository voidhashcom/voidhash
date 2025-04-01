"use client";

import { ChevronRight, type LucideIcon } from "lucide-react";

import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@voidhash/ui";
import {
	SidebarGroup,
	SidebarGroupLabel,
	SidebarMenu,
	SidebarMenuAction,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarMenuSub,
	SidebarMenuSubButton,
	SidebarMenuSubItem,
} from "@voidhash/ui";

export function NavMain({
	link: Link,
	groups,
	tooltips = "enabled",
}: {
	link: React.ElementType;
	groups: {
		title: string;
		items: {
			title: string;
			url: string;
			icon?: LucideIcon;
			isActive?: () => boolean;
			items?: {
				title: string;
				url: string;
			}[];
		}[];
	}[];
	tooltips?: "enabled" | "disabled";
}) {
	return (
		<>
			{groups.map((group) => (
				<SidebarGroup key={group.title}>
					<SidebarGroupLabel>{group.title}</SidebarGroupLabel>
					<SidebarMenu>
						{group.items.map((item) => (
							<Collapsible
								key={item.title}
								asChild
								defaultOpen={item.isActive?.()}
							>
								<SidebarMenuItem>
									<SidebarMenuButton
										asChild
										tooltip={tooltips === "enabled" ? item.title : null}
										isActive={item.isActive?.()}
									>
										<Link to={item.url}>
											{item.icon && (
												<item.icon className="text-muted-foreground" />
											)}
											<span>{item.title}</span>
										</Link>
									</SidebarMenuButton>
									{item.items?.length ? (
										<>
											<CollapsibleTrigger asChild>
												<SidebarMenuAction className="data-[state=open]:rotate-90">
													<ChevronRight />
													<span className="sr-only">Toggle</span>
												</SidebarMenuAction>
											</CollapsibleTrigger>
											<CollapsibleContent>
												<SidebarMenuSub>
													{item.items?.map((subItem) => (
														<SidebarMenuSubItem key={subItem.title}>
															<SidebarMenuSubButton
																isActive={item.isActive?.()}
																asChild
															>
																<Link to={subItem.url}>
																	<span>{subItem.title}</span>
																</Link>
															</SidebarMenuSubButton>
														</SidebarMenuSubItem>
													))}
												</SidebarMenuSub>
											</CollapsibleContent>
										</>
									) : null}
								</SidebarMenuItem>
							</Collapsible>
						))}
					</SidebarMenu>
				</SidebarGroup>
			))}
		</>
	);
}
