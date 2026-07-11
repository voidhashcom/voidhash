import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { RpcExperimentVariant } from "@voidhash/rpc";
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@voidhash/ui";
import { Pause, Play, Trophy } from "lucide-react";
import { useState } from "react";

import { EXPERIMENT_STATUS } from "./experiment-status";
import {
  archiveExperimentOptions,
  concludeExperimentOptions,
  pauseExperimentOptions,
  queryKeys,
  restoreExperimentOptions,
  startExperimentOptions,
} from "@/features/studio/lib/tanstack-query";

function ConcludeExperimentDialog({
  experimentId,
  variants,
  disabled,
  onConcluded,
}: {
  experimentId: string;
  variants: readonly (typeof RpcExperimentVariant.Type)[];
  disabled?: boolean;
  onConcluded: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [winningVariantId, setWinningVariantId] = useState("");

  const conclude = useMutation({
    ...concludeExperimentOptions(),
    onSuccess: () => {
      onConcluded();
      setOpen(false);
      setWinningVariantId("");
    },
  });

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger asChild>
        <Button disabled={disabled} variant="outline">
          <Trophy className="mr-2 h-4 w-4" />
          Conclude
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Conclude Experiment</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-muted-foreground text-sm">
            Concluding stops assignment. Optionally pick the winning variant.
          </p>
          <div className="space-y-2">
            <Label>Winning variant (optional)</Label>
            <Select onValueChange={setWinningVariantId} value={winningVariantId}>
              <SelectTrigger>
                <SelectValue placeholder="No winner" />
              </SelectTrigger>
              <SelectContent>
                {variants.map((variant) => (
                  <SelectItem key={variant.id} value={variant.id}>
                    {variant.name || variant.key}
                    {variant.isControl ? " (control)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-2">
            <Button onClick={() => setOpen(false)} type="button" variant="outline">
              Cancel
            </Button>
            <Button
              disabled={conclude.isPending}
              onClick={() =>
                conclude.mutate({
                  id: experimentId,
                  winningVariantId: winningVariantId || undefined,
                })
              }
            >
              {conclude.isPending ? "Concluding..." : "Conclude"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function ExperimentLifecycleControls({
  experimentId,
  status,
  archivedAt,
  variants,
}: {
  experimentId: string;
  status: number;
  archivedAt: Date | null;
  variants: readonly (typeof RpcExperimentVariant.Type)[];
}) {
  const queryClient = useQueryClient();

  const invalidate = () => {
    queryClient.invalidateQueries({
      queryKey: queryKeys.experiment.getExperiment(experimentId),
    });
    queryClient.invalidateQueries({
      queryKey: queryKeys.experiment.all,
    });
  };

  const start = useMutation({ ...startExperimentOptions(), onSuccess: invalidate });
  const pause = useMutation({ ...pauseExperimentOptions(), onSuccess: invalidate });
  const archive = useMutation({ ...archiveExperimentOptions(), onSuccess: invalidate });
  const restore = useMutation({ ...restoreExperimentOptions(), onSuccess: invalidate });

  const isArchived = archivedAt !== null;
  const isRunning = status === EXPERIMENT_STATUS.running;
  const isConcluded = status === EXPERIMENT_STATUS.concluded;
  const canStart = status === EXPERIMENT_STATUS.draft || status === EXPERIMENT_STATUS.paused;

  return (
    <div className="flex gap-2">
      {!isArchived && !isConcluded && (
        <>
          {canStart && (
            <Button disabled={start.isPending} onClick={() => start.mutate({ id: experimentId })}>
              <Play className="mr-2 h-4 w-4" />
              {start.isPending ? "Starting..." : status === EXPERIMENT_STATUS.paused ? "Resume" : "Start"}
            </Button>
          )}
          {isRunning && (
            <Button
              disabled={pause.isPending}
              onClick={() => pause.mutate({ id: experimentId })}
              variant="outline"
            >
              <Pause className="mr-2 h-4 w-4" />
              {pause.isPending ? "Pausing..." : "Pause"}
            </Button>
          )}
          <ConcludeExperimentDialog
            disabled={status === EXPERIMENT_STATUS.draft}
            experimentId={experimentId}
            onConcluded={invalidate}
            variants={variants}
          />
        </>
      )}

      {isArchived ? (
        <Button
          disabled={restore.isPending}
          onClick={() => restore.mutate({ id: experimentId })}
          variant="outline"
        >
          {restore.isPending ? "Restoring..." : "Restore"}
        </Button>
      ) : (
        <Button
          disabled={archive.isPending}
          onClick={() => archive.mutate({ id: experimentId })}
          variant="destructive"
        >
          {archive.isPending ? "Archiving..." : "Archive"}
        </Button>
      )}
    </div>
  );
}
