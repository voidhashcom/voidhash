import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense, type ComponentType } from "react";

import { prefetchPaywallEditSession } from "@/features/studio/paywalls/designer/edit-session";
import { DesignerLoadingScreen } from "@/features/studio/paywalls/designer/loading-screen";

const loadPaywallDesigner = () => import("@/features/studio/paywalls/designer/paywall-designer");

const DesignerDetailPage = import.meta.env.SSR
  ? null
  : lazy(() =>
      loadPaywallDesigner().then((module) => ({
        default: module.DesignerDetailPage,
      })),
    );

export const Route = createFileRoute(
  "/studio/_authenticated/_designer/$organizationSlug/$projectSlug/design/$id",
)({
  // The designer only runs in the browser; keeping the route client-only also
  // keeps the loader's prefetches out of the server, whose module-level
  // caches would never be consumed.
  ssr: false,
  // Runs in parallel with the `_authenticated` auth loader, so the designer
  // chunk and the document edit session load concurrently with the auth
  // round-trip instead of queueing behind it. Hover preloads only warm the
  // chunk — edit tokens are single-use mints, so one is only minted for a
  // committed navigation.
  loader: ({ params, preload }) => {
    void loadPaywallDesigner();
    if (!preload) {
      void prefetchPaywallEditSession(params.id);
    }
  },
  component: DesignerDetailPageComponent,
});

function DesignerDetailPageComponent() {
  const { id: paywallId } = Route.useParams();
  const Page = DesignerDetailPage as ComponentType<{ paywallId: string }> | null;

  if (!Page) {
    return null;
  }

  return (
    <Suspense fallback={<DesignerLoadingScreen />}>
      <Page paywallId={paywallId} />
    </Suspense>
  );
}
