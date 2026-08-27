import { createFileRoute } from "@tanstack/react-router";
import { createIsomorphicFn } from "@tanstack/react-start";
import { INTERNAL_FEATURE_FLAGS, type User } from "@voidhash/rpc";
import { lazy, Suspense, type ComponentType } from "react";

import { useInternalFeatureFlag } from "@/features/studio/lib/useInternalFeatureFlag";
import { queryKeys } from "@/features/studio/lib/tanstack-query";
import { DesignerLoadingScreen } from "@/features/studio/paywalls/designer/loading-screen";
import { VoidhashErrorCard } from "@/features/studio/shell/components/voidhash-error-card";

const loadPaywallDesigner = () => import("@/features/studio/paywalls/designer/paywall-designer");

// The compiler removes this body from the server build. Keeping both imports
// inside the client boundary prevents the paywall designer's editor-only WASM
// and worker assets from becoming modules in the deployed Cloudflare Worker.
const preloadPaywallDesignerRoute = createIsomorphicFn().client(
  ({ paywallId, preload }: { paywallId: string; preload: boolean }) => {
    const loadPaywallEditSession = () => import("@/features/studio/paywalls/designer/edit-session");
    void loadPaywallDesigner();
    if (!preload) {
      void loadPaywallEditSession().then(({ prefetchPaywallEditSession }) =>
        prefetchPaywallEditSession(paywallId),
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
  // round-trip instead of queueing behind them. Hover preloads and navigations
  // without a cached enabled paywalls flag only warm the chunk — edit tokens
  // are single-use and must not be minted before the feature gate is known.
  loader: ({ context, params, preload }) => {
    const user = context.queryClient.getQueryData<typeof User.Type>(queryKeys.user.getUser());
    const paywallsEnabled =
      user?.organizations
        .find((organization) => organization.slug === params.organizationSlug)
        ?.internalFeatureFlags.includes(INTERNAL_FEATURE_FLAGS.paywalls.key) ?? false;
    preloadPaywallDesignerRoute({
      paywallId: params.id,
      preload: preload || !paywallsEnabled,
    });
  },
  component: DesignerDetailPageComponent,
});

function DesignerDetailPageComponent() {
  const { id: paywallId } = Route.useParams();
  const paywallsEnabled = useInternalFeatureFlag(INTERNAL_FEATURE_FLAGS.paywalls.key);
  const Page = DesignerDetailPage as ComponentType<{ paywallId: string }> | null;

  if (!paywallsEnabled) {
    return (
      <VoidhashErrorCard error={{ code: "NOT_FOUND", message: "This page is not available." }} />
    );
  }

  if (!Page) {
    return null;
  }

  return (
    <Suspense fallback={<DesignerLoadingScreen />}>
      <Page paywallId={paywallId} />
    </Suspense>
  );
}
