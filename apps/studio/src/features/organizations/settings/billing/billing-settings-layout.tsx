import { Page } from "src/features/shell";

export function BillingSettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Page>
      <div className="mx-auto max-w-4xl">
        <h1 className="font-normal text-3xl tracking-right">Billing & Usage</h1>
        <p className="mt-3 text-muted-foreground">
          Manage your subscription and monitor usage
        </p>

        {children}
      </div>
    </Page>
  );
}
