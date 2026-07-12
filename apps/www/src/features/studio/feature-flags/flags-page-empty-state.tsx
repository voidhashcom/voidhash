"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@voidhash/ui";

import { CreateFlagModal } from "./create-flag-modal";

export function FlagsPageEmptyState({ projectId }: { projectId: string }) {
  return (
    <Card className="mx-auto w-full max-w-5xl text-center">
      <CardHeader>
        <CardTitle>No feature flags yet</CardTitle>
        <CardDescription className="mx-auto max-w-md text-balance">
          Feature flags let you roll out changes gradually, target specific people, and serve
          multiple variants without shipping new code. Create your first flag to get started.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <CreateFlagModal projectId={projectId} />
      </CardContent>
    </Card>
  );
}
