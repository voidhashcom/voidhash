import { Page } from "src/features/shell";

export function SettingsGeneralLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Page>
      {/* Key is used to reload the default form data when the organization slug changes */}
      <div className="mx-auto max-w-4xl">
        <h1 className="font-normal text-3xl tracking-right">Team Settings</h1>
        <p className="mt-3 text-muted-foreground">All settings for team</p>

        {children}
      </div>
    </Page>
  );
}
