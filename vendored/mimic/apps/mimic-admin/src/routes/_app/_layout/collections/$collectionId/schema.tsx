import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Schema, SchemaGetter, SchemaTransformation } from "effect";

import { useMimicSdk } from "@/components/sdk-context";
import { useDatabase } from "@/components/database-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { collectionsQuery } from "@/lib/queries";

/** JSON text codec that encodes with two-space indentation for display. */
const PrettyJson = Schema.String.pipe(
  Schema.decodeTo(
    Schema.Unknown,
    new SchemaTransformation.Transformation<unknown, string>(
      SchemaGetter.parseJson(),
      SchemaGetter.stringifyJson({ space: 2 }),
    ),
  ),
);

const encodePrettyJson = Schema.encodeSync(PrettyJson);

export const Route = createFileRoute("/_app/_layout/collections/$collectionId/schema")({
  component: SchemaPage,
});

function SchemaPage() {
  const { collectionId } = Route.useParams();
  const sdk = useMimicSdk();
  const { selectedDatabaseId } = useDatabase();
  const { data: collections } = useQuery({
    ...collectionsQuery(sdk, selectedDatabaseId ?? ""),
    enabled: !!selectedDatabaseId,
  });

  const collection = collections?.find((entry) => entry.id === collectionId);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Collection Schema</h2>
        <p className="text-sm text-muted-foreground">Collection: {collectionId}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Managed Schema</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            This schema is managed by deployed migrations and is read-only here.
          </p>
          <p className="text-sm">
            Migration version: {collection?.migrationVersion ?? "unmanaged"}
          </p>
          <pre className="max-h-[500px] overflow-auto rounded-md bg-muted p-4 text-xs">
            {encodePrettyJson(collection?.schemaJson ?? {})}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}
