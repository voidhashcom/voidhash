import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Button,
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Separator,
  Slider,
  Switch,
  Textarea,
} from "@voidhash/ui";
import { Info } from "lucide-react";
import { useState } from "react";

import { queryKeys, updateFeatureFlagOptions } from "@/features/studio/lib/tanstack-query";

import type { FlagType } from "./flag-type";

type FlagData = {
  description: string | null;
  enabled: boolean;
  id: string;
  key: string;
  name: string;
  rolloutBps: number;
};

export function FlagGeneralForm({
  flag,
  flagType,
  readOnly,
}: {
  flag: FlagData;
  flagType: FlagType;
  readOnly?: boolean;
}) {
  const [name, setName] = useState(flag.name);
  const [key, setKey] = useState(flag.key);
  const [description, setDescription] = useState(flag.description ?? "");
  const [enabled, setEnabled] = useState(flag.enabled);
  const [rolloutBps, setRolloutBps] = useState(flag.rolloutBps);
  const queryClient = useQueryClient();

  const updateFlag = useMutation({
    ...updateFeatureFlagOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.featureFlag.getFlag(flag.id),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.featureFlag.all,
      });
    },
  });

  const hasChanges =
    name !== flag.name ||
    key !== flag.key ||
    description !== (flag.description ?? "") ||
    enabled !== flag.enabled ||
    rolloutBps !== flag.rolloutBps;

  return (
    <Card>
      <CardHeader>
        <CardTitle>General</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <Label htmlFor="flag-enabled">Enabled</Label>
            <p className="text-muted-foreground text-sm">Toggle the flag on or off globally.</p>
          </div>
          <Switch
            checked={enabled}
            disabled={readOnly}
            id="flag-enabled"
            onCheckedChange={setEnabled}
          />
        </div>

        {flagType === "multivariant" ? (
          <div className="flex items-center gap-2 rounded-md bg-muted/50 px-3 py-2 text-muted-foreground text-sm">
            <Info className="h-4 w-4 shrink-0" />
            <span>Rollout is managed by variant weights.</span>
          </div>
        ) : (
          <div className="space-y-2">
            <Label>Rollout Percentage</Label>
            <div className="flex items-center gap-4">
              <Slider
                disabled={readOnly}
                max={10000}
                min={0}
                onValueChange={([v]) => setRolloutBps(v ?? 0)}
                step={100}
                value={[rolloutBps]}
              />
              <span className="w-16 text-right text-sm">{(rolloutBps / 100).toFixed(0)}%</span>
            </div>
          </div>
        )}

        <Separator />

        <div className="space-y-2">
          <Label htmlFor="flag-name">Name</Label>
          <Input
            disabled={readOnly}
            id="flag-name"
            onChange={(e) => setName(e.target.value)}
            value={name}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="flag-key">Key</Label>
          <Input
            disabled={readOnly}
            id="flag-key"
            onChange={(e) => setKey(e.target.value)}
            value={key}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="flag-description">Description</Label>
          <Textarea
            disabled={readOnly}
            id="flag-description"
            onChange={(e) => setDescription(e.target.value)}
            value={description}
          />
        </div>
      </CardContent>
      {hasChanges && !readOnly && (
        <CardFooter className="flex justify-end gap-2 border-t pt-4">
          <Button
            onClick={() => {
              setName(flag.name);
              setKey(flag.key);
              setDescription(flag.description ?? "");
              setEnabled(flag.enabled);
              setRolloutBps(flag.rolloutBps);
            }}
            variant="outline"
          >
            Reset
          </Button>
          <Button
            disabled={updateFlag.isPending}
            onClick={() =>
              updateFlag.mutate({
                description: description || null,
                enabled,
                id: flag.id,
                key,
                name,
                rolloutBps,
              })
            }
          >
            {updateFlag.isPending ? "Saving..." : "Save Changes"}
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}
