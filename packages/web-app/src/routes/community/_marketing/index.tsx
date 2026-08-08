import { createFileRoute } from "@tanstack/react-router";

import { MarketingHome, marketingHomeLoader } from "@/features/www/marketing-home-slot";

export const Route = createFileRoute("/_marketing/")({
  component: MarketingHome,
  loader: marketingHomeLoader,
});
