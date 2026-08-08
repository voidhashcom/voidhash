import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense, type ComponentType } from "react";
import { Spinner } from "@voidhash/ui";

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
  component: DesignerDetailPageComponent,
});

function DesignerDetailPageComponent() {
  const { id: paywallId } = Route.useParams();
  const Page = DesignerDetailPage as ComponentType<{ paywallId: string }> | null;

  if (!Page) {
    return null;
  }

  return (
    <Suspense
      fallback={
        <div className="flex h-screen w-screen items-center justify-center">
          <Spinner />
        </div>
      }
    >
      <Page paywallId={paywallId} />
    </Suspense>
  );
}
