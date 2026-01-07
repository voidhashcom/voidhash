import { createFileRoute } from "@tanstack/react-router";

import { DesignerDetailPage } from "@/features/paywalls/designer/paywall-designer";

export const Route = createFileRoute(
  "/_authenticated/_designer/$organizationSlug/$projectSlug/design/$id"
)({
  component: DesignerDetailPageComponent,
});

function DesignerDetailPageComponent() {
  const { id: paywallId } = Route.useParams();
  return <DesignerDetailPage paywallId={paywallId} />;
}
