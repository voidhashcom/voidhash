// "use client";

// import type * as React from "react";

// import { Link, useLocation, useParams } from "@tanstack/react-router";
// import {
//   GradientAvatar,
//   Sidebar,
//   SidebarContent,
//   SidebarGroup,
//   SidebarGroupLabel,
//   SidebarHeader,
//   SidebarMenu,
//   SidebarMenuButton,
//   SidebarMenuItem,
// } from "@voidhash/ui";
// import { useAuth } from "@/features/studio/components/auth-context";

// import { NavMain } from "./nav-main";

// const SidebarProjects = ({ organizationSlug }: { organizationSlug: string }) => {
//   const { user } = useAuth();

//   const organization = user.organizations.find((o) => o.slug === organizationSlug);
//   const projects = organization
//     ? user.projects.filter((p) => p.organizationId === organization.id)
//     : [];

//   return (
//     <SidebarMenu>
//       {projects.map((project) => (
//         <SidebarMenuItem key={project.id}>
//           <SidebarMenuButton asChild isActive={false} tooltip={null}>
//             <Link
//               params={{ organizationSlug, projectSlug: project.slug }}
//               to="/studio/$organizationSlug/$projectSlug/settings/general"
//             >
//               <div className="flex items-center gap-2">
//                 <GradientAvatar
//                   alt={project.name}
//                   className="h-6 w-6 rounded-lg text-xs"
//                   fallback={project.id}
//                   src={undefined}
//                 />
//                 <span className="truncate text-foreground- text-sm">{project.name}</span>
//               </div>
//             </Link>
//           </SidebarMenuButton>
//         </SidebarMenuItem>
//       ))}
//     </SidebarMenu>
//   );
// };

// export function OrganizationSettingsSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
//   const pathname = useLocation({
//     select: (location) => location.pathname,
//   });
//   const { organizationSlug } = useParams({
//     strict: false,
//   });

//   const data = {
//     navMain: [
//       {
//         items: [
//           {
//             isActive: () => pathname.startsWith(`/studio/${organizationSlug}/~/settings/general`),
//             title: "General",
//             url: `/studio/${organizationSlug}/~/settings/general`,
//           },
//           {
//             isActive: () => pathname.startsWith(`/studio/${organizationSlug}/~/settings/billing`),
//             title: "Billing",
//             url: `/studio/${organizationSlug}/~/settings/billing`,
//           },
//         ],
//         title: "Team",
//       },
//     ],
//   };

//   return (
//     <Sidebar
//       className="!top-[var(--header-height)] !h-[calc(100svh-var(--header-height))] sticky flex border-r transition-all duration-75"
//       collapsible="none"
//       variant="inset"
//       {...props}
//     >
//       <SidebarHeader className="gap-3.5 border-b p-4">
//         <div className="flex w-full items-center justify-between">
//           <div className="font-medium text-base text-foreground">Team Settings</div>
//         </div>
//       </SidebarHeader>
//       <SidebarContent>
//         <NavMain groups={data.navMain} link={Link} tooltips="disabled" />
//         <SidebarGroup>
//           <SidebarGroupLabel>Projects</SidebarGroupLabel>
//           <SidebarProjects
//             organizationSlug={typeof organizationSlug === "string" ? organizationSlug : ""}
//           />
//         </SidebarGroup>
//       </SidebarContent>
//     </Sidebar>
//   );
// }
