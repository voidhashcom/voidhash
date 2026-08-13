import { createFileRoute } from "@tanstack/react-router";
import { createIsomorphicFn } from "@tanstack/react-start";
import { lazy, Suspense, type ComponentType } from "react";

import { DesignerLoadingScreen } from "@/features/studio/paywalls/designer/loading-screen";

const loadPaywallDesigner = () => import("@/features/studio/paywalls/designer/paywall-designer");

// The compiler removes this body from the server build. Keeping both imports
// inside the client boundary prevents the paywall designer's editor-only WASM
// and worker assets from becoming modules in the deployed Cloudflare Worker.
const preloadPaywallDesignerRoute = createIsomorphicFn().client(
  ({ paywallId, preload }: { paywallId: string; preload: boolean }) => {
    const loadPaywallEditSession = () =>
      import("@/features/studio/paywalls/designer/edit-session");
    void loadPaywallDesigner();
    if (!preload) {
      void loadPaywallEditSession().then(
        ({ prefetchPaywallEditSession }) => prefetchPaywallEditSession(paywallId),
      );
    }
  },
);

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
  // round-trip instead of queueing behind them. Hover preloads only warm the
  // chunk — edit tokens are single-use mints, so one is only minted for a
  // committed navigation.
  loader: ({ params, preload }) => {
    preloadPaywallDesignerRoute({ paywallId: params.id, preload });
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
