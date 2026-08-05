import { Card } from "@voidhash/ui";

import { PerkRecordSkeleton } from "./perk-record-skeleton";

export function PerksPageSkeleton() {
  return (
    <div>
      <div className="flex flex-row items-center justify-between pt-6">
        <div>
          <h2 className="font-normal text-xl tracking-right">Perks</h2>
          <p className="mt-1 text-muted-foreground">List of unlockable features / perks.</p>
        </div>
      </div>

      <div className="mt-8">
        <Card className="grid gap-0 divide-y p-0">
          {Array.from({ length: 3 }).map((_, index) => (
            <PerkRecordSkeleton key={index} />
          ))}
        </Card>
      </div>
    </div>
  );
}
