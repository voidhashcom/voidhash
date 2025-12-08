import { createFileRoute } from '@tanstack/react-router';
import { DesignerDetailPage } from '@/features/designer/designer-detail-page';

export const Route = createFileRoute(
  '/_authenticated/_designer/$organizationSlug/$projectSlug/design/$id'
)({
  component: DesignerDetailPage
});
