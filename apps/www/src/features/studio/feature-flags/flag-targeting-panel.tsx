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
} from "@voidhash/ui";
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import {
  archiveFeatureFlagTargetOptions,
  queryKeys,
  upsertFeatureFlagTargetOptions,
} from "@/features/studio/lib/tanstack-query";

type Target = {
  id: string;
  identityType: number;
  identityValue: string;
  listType: number;
};

const IDENTITY_TYPE_LABELS: Record<number, string> = {
  1: "Person ID",
  2: "App User ID",
};

export function FlagTargetingPanel({
  featureFlagId,
  targets,
}: {
  featureFlagId: string;
  targets: Target[];
}) {
  const [identityType, setIdentityType] = useState("2");
  const [identityValue, setIdentityValue] = useState("");
  const [listType, setListType] = useState("1");
  const queryClient = useQueryClient();

  const invalidate = () => {
    queryClient.invalidateQueries({
      queryKey: queryKeys.featureFlag.getFlag(featureFlagId),
    });
  };

  const upsertTarget = useMutation({
    ...upsertFeatureFlagTargetOptions(),
    onSuccess: () => {
      invalidate();
      setIdentityValue("");
    },
  });

  const archiveTarget = useMutation({
    ...archiveFeatureFlagTargetOptions(),
    onSuccess: invalidate,
  });

  const allowTargets = targets.filter((t) => t.listType === 1);
  const denyTargets = targets.filter((t) => t.listType === 2);

  return (
    <div className="space-y-6">
      <form
        className="flex items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          upsertTarget.mutate({
            featureFlagId,
            identityType: Number.parseInt(identityType),
            identityValue,
            listType: Number.parseInt(listType),
          });
        }}
      >
        <div className="space-y-1">
          <Label>List</Label>
          <Select onValueChange={setListType} value={listType}>
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Allow</SelectItem>
              <SelectItem value="2">Deny</SelectItem>
            </SelectContent>
          </Select>
        </div>
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
        <Button disabled={!identityValue || upsertTarget.isPending} size="sm" type="submit">
          <Plus className="mr-1 h-4 w-4" />
          Add
        </Button>
      </form>

      {allowTargets.length > 0 && (
        <div>
          <h4 className="mb-2 font-medium text-sm">Allow List</h4>
          <div className="divide-y rounded-md border">
            {allowTargets.map((target) => (
              <div className="flex items-center justify-between px-3 py-2" key={target.id}>
                <span className="text-sm">
                  {IDENTITY_TYPE_LABELS[target.identityType]}: {target.identityValue}
                </span>
                <Button
                  disabled={archiveTarget.isPending}
                  onClick={() =>
                    archiveTarget.mutate({
                      id: target.id,
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
        </div>
      )}

      {denyTargets.length > 0 && (
        <div>
          <h4 className="mb-2 font-medium text-sm">Deny List</h4>
          <div className="divide-y rounded-md border">
            {denyTargets.map((target) => (
              <div className="flex items-center justify-between px-3 py-2" key={target.id}>
                <span className="text-sm">
                  {IDENTITY_TYPE_LABELS[target.identityType]}: {target.identityValue}
                </span>
                <Button
                  disabled={archiveTarget.isPending}
                  onClick={() =>
                    archiveTarget.mutate({
                      id: target.id,
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
        </div>
      )}

      {allowTargets.length === 0 && denyTargets.length === 0 && (
        <p className="text-muted-foreground text-sm">
          No targeting rules configured. The flag will be evaluated based on rollout percentage
          only.
        </p>
      )}
    </div>
  );
}
