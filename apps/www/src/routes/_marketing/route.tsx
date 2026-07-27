import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_marketing")({
  component: MarketingLayout,
});

function MarketingLayout() {
  return (
    <div className="min-h-screen bg-[#09090B]">
      <Outlet />
    </div>
  );
}
