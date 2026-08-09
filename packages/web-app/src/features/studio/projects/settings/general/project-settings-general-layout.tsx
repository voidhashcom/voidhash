import type { ReactNode } from "react";

import { SettingsPage } from "@/features/studio/settings";

export function ProjectSettingsGeneralLayout({ children }: { children: ReactNode }) {
  return <SettingsPage title="Project Settings">{children}</SettingsPage>;
}
