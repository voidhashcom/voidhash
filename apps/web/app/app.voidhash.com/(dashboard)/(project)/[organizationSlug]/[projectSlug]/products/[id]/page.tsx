import { ProductDetailPage } from '@/features/products/product-detail-page';

export default async function Page({
  params
}: {
  params: Promise<{
    organizationSlug: string;
    projectSlug: string;
    id: string;
  }>;
}) {
  const { organizationSlug, projectSlug, id } = await params;
  return (
    <ProductDetailPage
      id={id}
      organizationSlug={organizationSlug}
      projectSlug={projectSlug}
    />
  );
}
