import { type ReactNode, useMemo, useState } from "react";

import { PaywallPreview } from "./components/PaywallPreview";
import { Sidebar } from "./components/Sidebar";
import { loadProjectContent } from "./voidhash/paywalls";
import {
  DEFAULT_PREVIEW_DEVICE_PROFILE,
  previewConfigForDevice,
} from "./voidhash/preview-devices";
import { createStudioBridge, type PreviewEvent } from "./voidhash/preview-runtime";

const projectName = (root: string): string => root.replace(/\/+$/, "").split("/").pop() || root;

export const App = (): ReactNode => {
  // Recomputed every render so HMR (add/remove/edit paywalls) is reflected.
  const content = loadProjectContent();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [events, setEvents] = useState<ReadonlyArray<PreviewEvent>>([]);
  const previewProfile = DEFAULT_PREVIEW_DEVICE_PROFILE;
  const previewConfig = useMemo(() => previewConfigForDevice(previewProfile), [previewProfile]);

  const bridge = useMemo(
    () => createStudioBridge((event) => setEvents((prev) => [...prev, event])),
    [],
  );

  // Resolve the active paywall, falling back to the first available one so the
  // preview is never empty when paywalls exist.
  const selected = content.paywalls.find((p) => p.id === selectedId) ?? content.paywalls[0] ?? null;

  const handleSelect = (id: string) => {
    setSelectedId(id);
    setEvents([]);
  };

  return (
    <div className="flex h-full flex-col bg-neutral-900 text-neutral-100">
      <header className="flex items-center justify-between border-neutral-800 border-b px-5 py-3">
        <div className="flex items-baseline gap-2">
          <span className="font-semibold text-sm">Voidhash Studio</span>
          <span className="text-neutral-500 text-xs">{projectName(content.projectRoot)}</span>
        </div>
        {selected && (
          <div className="flex items-center gap-3 text-neutral-400 text-xs">
            <span>{selected.title}</span>
            <span className="rounded bg-neutral-800 px-2 py-0.5 uppercase">
              {previewProfile.platform}
            </span>
          </div>
        )}
      </header>

      <div className="flex min-h-0 flex-1">
        <main className="min-w-0 flex-1">
          {selected ? (
            <PaywallPreview
              bridge={bridge}
              config={previewConfig}
              entry={selected}
              profile={previewProfile}
            />
          ) : (
            <div className="flex h-full items-center justify-center p-8 text-center text-neutral-500 text-sm">
              Create a paywall in{" "}
              <code className="mx-1 rounded bg-neutral-800 px-1.5 py-0.5">.voidhash/paywalls</code>{" "}
              to preview it here.
            </div>
          )}
        </main>

        <Sidebar
          components={content.components}
          events={events}
          invalid={content.invalid}
          onClearEvents={() => setEvents([])}
          onSelect={handleSelect}
          paywalls={content.paywalls}
          profile={previewProfile}
          selectedId={selected?.id ?? null}
        />
      </div>
    </div>
  );
};
