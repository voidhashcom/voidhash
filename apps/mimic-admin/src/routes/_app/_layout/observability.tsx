import { createFileRoute } from "@tanstack/react-router";
import { Activity } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_app/_layout/observability")({
  component: ObservabilityPage,
});

function ObservabilityPage() {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Observability</h2>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Health Check
          </CardTitle>
          <CardDescription>Observability features coming soon.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            This page will display server health, metrics, and logs.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
