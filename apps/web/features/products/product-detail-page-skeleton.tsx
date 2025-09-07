import { SettingsCardSkeleton, Skeleton } from '@voidhash/ui';
import { Page } from '@/features/shell';

export function ProductsDetailPageSkeleton() {
  return (
    <Page
      breadcrumbs={[
        {
          title: 'Products'
        },
        {
          title: 'Product',
          isLoading: true
        }
      ]}
    >
      {/* Key is used to reload the default form data when the organization slug changes */}
      <div className="mx-auto max-w-4xl">
        <div className="flex flex-row items-center justify-between">
          <Skeleton className="h-8 w-40" />
        </div>
        <div className="mt-8">
          {Array.from({ length: 2 }).map((_, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: skeleton
            <SettingsCardSkeleton key={index} />
          ))}
        </div>
      </div>
    </Page>
  );
}
