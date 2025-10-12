import { Card } from '@voidhash/ui';
import { ApiKeyRecordSkeleton } from './api-key-record-skeleton';

export function ProjectApiKeysPageSkeleton() {
  return (
    <div>
      <div className="flex flex-row items-center justify-between pt-6">
        <div>
          <h2 className="font-normal text-xl tracking-right">API Keys</h2>
          <p className="mt-1 text-muted-foreground">Manage your API keys</p>
        </div>
      </div>

      <div className="mt-8">
        <Card className="grid gap-0 divide-y p-0">
          {Array.from({ length: 3 }).map((_, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: just a skeleton
            <ApiKeyRecordSkeleton key={index} />
          ))}
        </Card>
      </div>
    </div>
  );
}
