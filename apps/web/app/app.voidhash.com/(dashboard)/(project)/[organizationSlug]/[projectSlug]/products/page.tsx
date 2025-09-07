import { ProductsPage } from '@/features/products/products-page';

export default async function Page({
  params
}: {
  params: Promise<{
    organizationSlug: string;
    projectSlug: string;
  }>;
}) {
  const { organizationSlug, projectSlug } = await params;
  return (
    <ProductsPage
      organizationSlug={organizationSlug}
      projectSlug={projectSlug}
    />
  );
}
