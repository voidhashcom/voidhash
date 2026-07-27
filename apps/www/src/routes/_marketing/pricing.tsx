import { createFileRoute } from "@tanstack/react-router";

import { PricingPage } from "@/features/www/pricing/pricing-page";

export const Route = createFileRoute("/_marketing/pricing")({
  component: MarketingPricing,
});

function MarketingPricing() {
  return <PricingPage />;
}
