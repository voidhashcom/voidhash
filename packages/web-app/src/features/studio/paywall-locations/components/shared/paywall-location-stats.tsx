export interface PaywallLocationStatsProps {
  readonly description: string;
  readonly emptyDescription: string;
  readonly emptyTitle: string;
  readonly locationSlugs: string[];
  readonly projectId: string;
}

/** Community omits paywall-event performance because those custom events are not retained. */
export function PaywallLocationStats(_props: PaywallLocationStatsProps) {
  return null;
}
