import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";

import { useMimicSdk } from "@/components/sdk-context";
import { useDatabase } from "@/components/database-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { collectionsQuery } from "@/lib/queries";

export const Route = createFileRoute("/_app/_layout/collections/$collectionId/schema")({
  component: SchemaPage,
});

function SchemaPage() {
  const { collectionId } = Route.useParams();
  const sdk = useMimicSdk();
  const { selectedDatabaseId } = useDatabase();
  const queryClient = useQueryClient();
  const { data: collections } = useQuery({
    ...collectionsQuery(sdk, selectedDatabaseId ?? ""),
    enabled: !!selectedDatabaseId,
  });

  const [schemaJson, setSchemaJson] = useState("{}");
  const collection = collections?.find((entry) => entry.id === collectionId);

  useEffect(() => {
    if (!collection) {
      return;
    }
    setSchemaJson(JSON.stringify(collection.schemaJson, null, 2));
  }, [collection]);

  const updateMutation = useMutation({
    mutationFn: () => {
      const parsed = JSON.parse(schemaJson);
      return sdk.database(selectedDatabaseId ?? "").updateCollectionSchemaRaw(collectionId, parsed);
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({
        queryKey: ["collections"],
      });
      toast.success(`Schema updated to version ${result.schemaVersion}`);
    },
    onError: (err) => toast.error(`Failed to update schema: ${err.message}`),
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Collection Schema</h2>
        <p className="text-sm text-muted-foreground">Collection: {collectionId}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Update Schema</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              try {
                JSON.parse(schemaJson);
                updateMutation.mutate();
              } catch {
                toast.error("Invalid JSON");
              }
            }}
            className="grid gap-4"
          >
            <div className="grid gap-2">
              <Label>Schema JSON</Label>
              <Textarea
                value={schemaJson}
                onChange={(e) => setSchemaJson(e.target.value)}
                className="min-h-[300px] font-mono text-sm"
              />
            </div>
            <Button type="submit" disabled={updateMutation.isPending} className="w-fit">
              {updateMutation.isPending ? "Updating..." : "Update Schema"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
