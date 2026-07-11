import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Button,
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
  queryKeys,
  upsertFeatureFlagOverrideOptions,
} from "@/features/studio/lib/tanstack-query";

type Override = {
  forcedEnabled: boolean | null;
  id: string;
  identityType: number;
  identityValue: string;
  note: string | null;
};

const IDENTITY_TYPE_LABELS: Record<number, string> = {
  1: "Person ID",
  2: "App User ID",
};

export function FlagOverridesPanel({
  featureFlagId,
  overrides,
}: {
  featureFlagId: string;
  overrides: Override[];
}) {
  const [identityType, setIdentityType] = useState("2");
  const [identityValue, setIdentityValue] = useState("");
  const [forcedEnabled, setForcedEnabled] = useState(true);
  const [note, setNote] = useState("");
  const queryClient = useQueryClient();

  const invalidate = () => {
    queryClient.invalidateQueries({
      queryKey: queryKeys.featureFlag.getFlag(featureFlagId),
    });
  };

  const upsertOverride = useMutation({
    ...upsertFeatureFlagOverrideOptions(),
    onSuccess: () => {
      invalidate();
      setIdentityValue("");
      setNote("");
    },
  });

  const archiveOverride = useMutation({
    ...archiveFeatureFlagOverrideOptions(),
    onSuccess: invalidate,
  });

  return (
    <div className="space-y-6">
      <form
        className="space-y-3 rounded-md border p-3"
        onSubmit={(e) => {
          e.preventDefault();
          upsertOverride.mutate({
            featureFlagId,
            forcedEnabled,
            identityType: Number.parseInt(identityType, 10),
            identityValue,
            note: note || undefined,
          });
        }}
      >
        <div className="flex items-end gap-3">
          <div className="space-y-1">
            <Label>Identity Type</Label>
            <Select onValueChange={setIdentityType} value={identityType}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Person ID</SelectItem>
                <SelectItem value="2">App User ID</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1 space-y-1">
            <Label>Identity Value</Label>
            <Input
              onChange={(e) => setIdentityValue(e.target.value)}
              placeholder="Enter identifier..."
              value={identityValue}
            />
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
          <Button disabled={!identityValue || upsertOverride.isPending} size="sm" type="submit">
            <Plus className="mr-1 h-4 w-4" />
            Add Override
          </Button>
        </div>
      </form>

      {overrides.length > 0 ? (
        <div className="divide-y rounded-md border">
          {overrides.map((override) => (
            <div className="flex items-center justify-between px-3 py-2" key={override.id}>
              <div>
                <span className="text-sm">
                  {IDENTITY_TYPE_LABELS[override.identityType]}: {override.identityValue}
                </span>
                <span className="ml-3 text-muted-foreground text-xs">
                  {override.forcedEnabled === true && "Forced ON"}
                  {override.forcedEnabled === false && "Forced OFF"}
                </span>
                {override.note && (
                  <span className="ml-2 text-muted-foreground text-xs">({override.note})</span>
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
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground text-sm">No overrides configured.</p>
      )}
    </div>
  );
}
