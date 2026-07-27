import type { ReactNode } from "react";

import { SettingsPage } from "@/features/studio/settings";

export function SettingsGeneralLayout({ children }: { children: ReactNode }) {
  return <SettingsPage title="Team Settings">{children}</SettingsPage>;
}
