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
  Textarea,
} from "@voidhash/ui";
import { useState } from "react";

import { queryKeys, updateExperimentOptions } from "@/features/studio/lib/tanstack-query";

type ExperimentData = {
  description: string | null;
  hypothesis: string | null;
  id: string;
  name: string;
  primaryMetricEventName: string;
  secondaryMetricEventNames: readonly string[] | null;
};

const parseEventNames = (value: string): string[] =>
  Array.from(
    new Set(
      value
        .split(/[\n,]/)
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0),
    ),
  );

export function ExperimentSettingsForm({
  experiment,
  readOnly,
}: {
  experiment: ExperimentData;
  readOnly?: boolean;
}) {
  const initialSecondary = (experiment.secondaryMetricEventNames ?? []).join(", ");
  const [name, setName] = useState(experiment.name);
  const [description, setDescription] = useState(experiment.description ?? "");
  const [hypothesis, setHypothesis] = useState(experiment.hypothesis ?? "");
  const [primaryMetricEventName, setPrimaryMetricEventName] = useState(
    experiment.primaryMetricEventName,
  );
  const [secondaryMetricEventNames, setSecondaryMetricEventNames] = useState(initialSecondary);
  const queryClient = useQueryClient();

  const updateExperiment = useMutation({
    ...updateExperimentOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.experiment.getExperiment(experiment.id),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.experiment.all,
      });
    },
  });

  const hasChanges =
    name !== experiment.name ||
    description !== (experiment.description ?? "") ||
    hypothesis !== (experiment.hypothesis ?? "") ||
    primaryMetricEventName !== experiment.primaryMetricEventName ||
    secondaryMetricEventNames !== initialSecondary;

  const reset = () => {
    setName(experiment.name);
    setDescription(experiment.description ?? "");
    setHypothesis(experiment.hypothesis ?? "");
    setPrimaryMetricEventName(experiment.primaryMetricEventName);
    setSecondaryMetricEventNames(initialSecondary);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Settings</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="experiment-name">Name</Label>
          <Input
            disabled={readOnly}
            id="experiment-name"
            onChange={(e) => setName(e.target.value)}
            value={name}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="experiment-description">Description</Label>
          <Textarea
            disabled={readOnly}
            id="experiment-description"
            onChange={(e) => setDescription(e.target.value)}
            value={description}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="experiment-hypothesis">Hypothesis</Label>
          <Textarea
            disabled={readOnly}
            id="experiment-hypothesis"
            onChange={(e) => setHypothesis(e.target.value)}
            value={hypothesis}
          />
        </div>

        <Separator />

        <div className="space-y-2">
          <Label htmlFor="experiment-primary-metric">Primary metric event</Label>
          <Input
            disabled={readOnly}
            id="experiment-primary-metric"
            onChange={(e) => setPrimaryMetricEventName(e.target.value)}
            placeholder="purchase_completed"
            value={primaryMetricEventName}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="experiment-secondary-metrics">Secondary metrics</Label>
          <Input
            disabled={readOnly}
            id="experiment-secondary-metrics"
            onChange={(e) => setSecondaryMetricEventNames(e.target.value)}
            placeholder="trial_started, paywall_viewed"
            value={secondaryMetricEventNames}
          />
          <p className="text-muted-foreground text-xs">Comma separated event names.</p>
        </div>
      </CardContent>
      {hasChanges && !readOnly && (
        <CardFooter className="flex justify-end gap-2 border-t pt-4">
          <Button onClick={reset} variant="outline">
            Reset
          </Button>
          <Button
            disabled={!name || !primaryMetricEventName || updateExperiment.isPending}
            onClick={() => {
              const secondary = parseEventNames(secondaryMetricEventNames);
              updateExperiment.mutate({
                description: description || null,
                hypothesis: hypothesis || null,
                id: experiment.id,
                name,
                primaryMetricEventName,
                secondaryMetricEventNames: secondary.length > 0 ? secondary : null,
              });
            }}
          >
            {updateExperiment.isPending ? "Saving..." : "Save Changes"}
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}
