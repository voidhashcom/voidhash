import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
} from "@voidhash/ui";
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import {
  archiveFeatureFlagOverrideOptions,
  listFeatureFlagOverridesByPersonOptions,
  listFeatureFlagsOptions,
  queryKeys,
  upsertFeatureFlagOverrideOptions,
} from "@/features/studio/lib/tanstack-query";

export function PersonFlagOverridesPanel({
  personId,
  projectId,
}: {
  personId: string;
  projectId: string;
}) {
  const [selectedFlagId, setSelectedFlagId] = useState("");
  const [forcedEnabled, setForcedEnabled] = useState(true);
  const [note, setNote] = useState("");
  const queryClient = useQueryClient();

  const { data: overrides } = useSuspenseQuery(
    listFeatureFlagOverridesByPersonOptions({
      identityType: 1,
      identityValue: personId,
      projectId,
    }),
  );

  const { data: flags } = useSuspenseQuery(listFeatureFlagsOptions({ projectId }));

  const flagMap = new Map(flags.map((flag) => [flag.id, flag]));

  const invalidate = () => {
    void queryClient.invalidateQueries({
      queryKey: queryKeys.featureFlag.overridesByPerson({
        identityType: 1,
        identityValue: personId,
        projectId,
      }),
    });
  };

  const upsertOverride = useMutation({
    ...upsertFeatureFlagOverrideOptions(),
    onSuccess: () => {
      invalidate();
      setSelectedFlagId("");
      setNote("");
    },
  });

  const archiveOverride = useMutation({
    ...archiveFeatureFlagOverrideOptions(),
    onSuccess: invalidate,
  });

  const overriddenFlagIds = new Set(overrides.map((o) => o.featureFlagId));
  const availableFlags = flags.filter(
    (f) => !overriddenFlagIds.has(f.id) && !f.internal && !f.archivedAt,
  );

  return (
    <Card className="gap-0 overflow-hidden pb-0">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-4">Feature Flag Overrides</CardTitle>
      </CardHeader>
      <CardContent className="divide-y divide-border border-border border-t px-0">
        {overrides.length > 0 ? (
          <>
            {overrides.map((override) => {
              const flag = flagMap.get(override.featureFlagId);
              return (
                <div className="flex items-center justify-between px-4 py-2.5" key={override.id}>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-medium text-sm">
                        {flag?.slug ?? "Unknown flag"}
                      </span>
                      <Badge variant={override.forcedEnabled ? "default" : "secondary"}>
                        {override.forcedEnabled ? "Forced ON" : "Forced OFF"}
                      </Badge>
                    </div>
                    {override.note && (
                      <p className="mt-0.5 text-muted-foreground text-xs">{override.note}</p>
                    )}
                  </div>
                  <Button
                    disabled={archiveOverride.isPending}
                    onClick={() =>
                      archiveOverride.mutate({
                        id: override.id,
                      })
                    }
                    size="icon"
                    variant="ghost"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              );
            })}
          </>
        ) : (
          <div className="flex h-full flex-col items-center justify-center py-6">
            <div className="text-muted-foreground text-sm">
              No feature flag overrides for this person.
            </div>
          </div>
        )}

        {availableFlags.length > 0 && (
          <form
            className="space-y-3 px-4 py-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (!selectedFlagId) {
                return;
              }
              upsertOverride.mutate({
                featureFlagId: selectedFlagId,
                forcedEnabled,
                identityType: 1,
                identityValue: personId,
                note: note || undefined,
              });
            }}
          >
            <div className="flex items-end gap-3">
              <div className="flex-1 space-y-1">
                <Label>Flag</Label>
                <Select onValueChange={setSelectedFlagId} value={selectedFlagId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a flag..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableFlags.map((flag) => (
                      <SelectItem key={flag.id} value={flag.id}>
                        {flag.slug}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Label>Force Enabled</Label>
                <Switch checked={forcedEnabled} onCheckedChange={setForcedEnabled} />
              </div>
            </div>
            <div className="flex items-end gap-3">
              <div className="flex-1 space-y-1">
                <Label>Note (optional)</Label>
                <Input
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Reason for override..."
                  value={note}
                />
              </div>
              <Button
                disabled={!selectedFlagId || upsertOverride.isPending}
                size="sm"
                type="submit"
              >
                <Plus className="mr-1 h-4 w-4" />
                Add Override
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
