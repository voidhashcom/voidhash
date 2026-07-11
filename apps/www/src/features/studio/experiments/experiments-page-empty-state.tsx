"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@voidhash/ui";

import { CreateExperimentModal } from "./create-experiment-modal";

export function ExperimentsPageEmptyState({ projectId }: { projectId: string }) {
  return (
    <Card className="mx-auto w-full max-w-5xl text-center">
      <CardHeader>
        <CardTitle>No A/B tests yet</CardTitle>
        <CardDescription className="mx-auto max-w-md text-balance">
          Run experiments to split traffic across variants and measure the impact of a change on
          the metrics that matter. Create your first experiment to get started.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <CreateExperimentModal projectId={projectId} />
      </CardContent>
    </Card>
  );
}
