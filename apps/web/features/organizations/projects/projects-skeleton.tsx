import { Card, Skeleton } from '@voidhash/ui';

export function ProjectsSkeleton() {
  return (
    <Card className="grid gap-0 divide-y p-0">
      {Array.from({ length: 3 }).map((_, index) => (
        <div
          className="group relative isolate px-6 py-4 hover:bg-accent/30"
          // biome-ignore lint/suspicious/noArrayIndexKey: just a skeleton
          key={index}
        >
          <div className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-4">
              <Skeleton className="h-8 w-8 rounded-lg" />
              <div className="flex flex-col">
                <Skeleton className="h-4 w-32" />
              </div>
            </div>
          </div>
        </div>
      ))}
    </Card>
  );
}
