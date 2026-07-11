import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
  Label,
  Textarea,
} from "@voidhash/ui";
import { useState } from "react";

import { createExperimentOptions, queryKeys } from "@/features/studio/lib/tanstack-query";

/**
 * Parse a comma / newline separated string of event names into a de-duplicated
 * list, dropping blanks. Mirrors how the treatments/metrics fields accept free
 * text but persist a clean array.
 */
const parseEventNames = (value: string): string[] =>
  Array.from(
    new Set(
      value
        .split(/[\n,]/)
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0),
    ),
  );

export function CreateExperimentModal({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [description, setDescription] = useState("");
  const [hypothesis, setHypothesis] = useState("");
  const [primaryMetricEventName, setPrimaryMetricEventName] = useState("");
  const [secondaryMetricEventNames, setSecondaryMetricEventNames] = useState("");
  const queryClient = useQueryClient();

  const createExperiment = useMutation({
    ...createExperimentOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.experiment.list({ projectId }),
      });
      setOpen(false);
      setName("");
      setKey("");
      setDescription("");
      setHypothesis("");
      setPrimaryMetricEventName("");
      setSecondaryMetricEventNames("");
    },
  });

  const handleNameChange = (value: string) => {
    setName(value);
    setKey(
      value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, ""),
    );
  };

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger asChild>
        <Button>Create Experiment</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Experiment</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            const secondary = parseEventNames(secondaryMetricEventNames);
            createExperiment.mutate({
              description: description || undefined,
              hypothesis: hypothesis || undefined,
              key,
              name,
              primaryMetricEventName,
              projectId,
              secondaryMetricEventNames: secondary.length > 0 ? secondary : undefined,
            });
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="experiment-name">Name</Label>
            <Input
              id="experiment-name"
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="My Experiment"
              value={name}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="experiment-key">Key</Label>
            <Input
              id="experiment-key"
              onChange={(e) => setKey(e.target.value)}
              placeholder="my-experiment"
              value={key}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="experiment-primary-metric">Primary metric event</Label>
            <Input
              id="experiment-primary-metric"
              onChange={(e) => setPrimaryMetricEventName(e.target.value)}
              placeholder="purchase_completed"
              value={primaryMetricEventName}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="experiment-secondary-metrics">Secondary metrics (optional)</Label>
            <Input
              id="experiment-secondary-metrics"
              onChange={(e) => setSecondaryMetricEventNames(e.target.value)}
              placeholder="trial_started, paywall_viewed"
              value={secondaryMetricEventNames}
            />
            <p className="text-muted-foreground text-xs">Comma separated event names.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="experiment-hypothesis">Hypothesis (optional)</Label>
            <Textarea
              id="experiment-hypothesis"
              onChange={(e) => setHypothesis(e.target.value)}
              placeholder="What do you expect to happen and why?"
              value={hypothesis}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="experiment-description">Description (optional)</Label>
            <Textarea
              id="experiment-description"
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does this experiment change?"
              value={description}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button onClick={() => setOpen(false)} type="button" variant="outline">
              Cancel
            </Button>
            <Button
              disabled={!name || !key || !primaryMetricEventName || createExperiment.isPending}
              type="submit"
            >
              {createExperiment.isPending ? "Creating..." : "Create"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
