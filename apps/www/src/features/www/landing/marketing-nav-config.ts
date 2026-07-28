import type { LucideIcon } from "lucide-react";

/** A marketing navigation link. Hrefs are plain strings so hosts can add pages the OSS build has no route for. */
export interface MarketingNavLink {
  label: string;
  href: string;
  icon: LucideIcon;
}

/**
 * Company links rendered in the marketing navbar and footer. The community build
 * ships none; hosts replace this module to add the pages their deployment has.
 */
export const MARKETING_COMPANY_LINKS: MarketingNavLink[] = [];
