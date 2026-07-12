import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@voidhash/ui";

import { Page } from "@/features/studio/shell";

interface AnalyticsScaffoldPageProps {
  title: string;
  description: string;
}

export function AnalyticsScaffoldPage({ title, description }: AnalyticsScaffoldPageProps) {
  return (
    <Page>
      <div className="mx-auto max-w-4xl">
        <div>
          <h1 className="font-normal text-3xl tracking-right">{title}</h1>
          <p className="mt-3 text-muted-foreground">{description}</p>
        </div>

        <Card className="mt-8 border-dashed">
          <CardHeader>
            <CardTitle>{title} analytics</CardTitle>
            <CardDescription>
              This page has been scaffolded and is ready for analytics widgets and data queries.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            No charts, tables, or filters have been added yet.
          </CardContent>
        </Card>
      </div>
    </Page>
  );
}
