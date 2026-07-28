import type { LucideIcon } from "lucide-react";

import type { RuntimeCapabilities } from "./runtime-capabilities";

/** A single sidebar entry, matching the item shape `SidebarShell` renders. */
export interface OrganizationNavItem {
  title: string;
  url: string;
  icon?: LucideIcon;
  isActive?: () => boolean;
}

export interface OrganizationNavSlotContext {
  readonly capabilities: RuntimeCapabilities | undefined;
  readonly organizationSlug: string;
  readonly pathname: string;
}

/**
 * Community extension slot for host-provided organization settings entries.
 * Hosts replace this module to append their own nav items.
 */
export function organizationSettingsNavItems(
  _context: OrganizationNavSlotContext,
): OrganizationNavItem[] {
  return [];
}
