import { Outlet, createFileRoute } from "@tanstack/react-router";

import { Navigation } from "@/features/www/navbar/navigation";

export const Route = createFileRoute("/_marketing")({
  component: MarketingLayout,
});

function MarketingLayout() {
  return (
    <div className="min-w-screen md:min-h-screen">
      <Navigation />
      <Outlet />
    </div>
  );
}
