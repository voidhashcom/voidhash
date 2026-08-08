"use client";

import { Logo } from "@voidhash/ui";
import { useEffect, useState } from "react";
import { useStore } from "zustand/react";

import { AiPanel } from "../designer/ai-panel/ai-panel";
import { Canvas } from "../designer/canvas/canvas";
import { PreviewCanvas } from "../designer/canvas/preview-canvas";
import { CodeEditorProvider } from "../designer/code-mode/code-editor-context";
import { CodeModeWorkspace } from "../designer/code-mode/code-mode-workspace";
import { DevModeView } from "../designer/dev-mode/dev-mode-view";
import {
  PaywallDesignerStoreProvider,
  usePaywallDesignerStore,
} from "../designer/state/designer-store";
import { TranslationModeWorkspace } from "../designer/translation-mode/translation-mode-workspace";
import { useCodeComponentCompilation } from "./hooks/use-code-component-compilation";
import { useKeyboardShortcuts } from "./hooks/use-keyboard-shortcuts";
import { usePaywallComponentCatalog } from "./hooks/use-paywall-component-catalog";
import { LeftPanel } from "./panels";
import { ActionPanel } from "./panels/action-panel";
import { RightPanel } from "./panels/right-panel";
import { TopPanel } from "./panels/top-panel";

function DesignerContent() {
  useKeyboardShortcuts();
  usePaywallComponentCatalog();
  useCodeComponentCompilation();
  const store = usePaywallDesignerStore();
  const mode = useStore(store, (state) => state.mode);
  const devModeEnabled = useStore(store, (state) => state.devMode.enabled);

  return (
    <CodeEditorProvider>
      <div className="relative h-screen w-screen overflow-hidden bg-background">
        {/* Dev mode view - shown when enabled */}
        {devModeEnabled && <DevModeView />}

        {/* Canvas layer - hidden when dev mode is enabled */}
        <div className={devModeEnabled ? "hidden" : undefined}>
          {mode === "design" && <Canvas />}
          {mode === "preview" && <PreviewCanvas />}
          {mode === "code" && <CodeModeWorkspace />}
          {mode === "translation" && <TranslationModeWorkspace />}
        </div>

        {/* Panel overlays - mounted once the document is ready, hidden in dev mode.
            The properties inspector is not shown in code mode (the preview pane
            takes the right side); the editor's tab bar carries its actions there.
            Translation mode is a self-contained full-screen surface (its own
            locale rail replaces the layer tree and floating action bar). */}
        <TopPanel />
        <div className={devModeEnabled ? "hidden" : undefined}>
          <AiPanel />
          {mode !== "translation" && <LeftPanel />}
          {mode !== "code" && mode !== "translation" && <RightPanel />}
          {mode !== "code" && mode !== "translation" && <ActionPanel />}
        </div>
      </div>
    </CodeEditorProvider>
  );
}

/**
 * Store-free loading visual, shown both before the store exists (token mint
 * in flight) and while the document snapshot has not arrived yet.
 */
function LoadingScreen() {
  return (
    <div className="flex h-screen flex-col gap-8 w-screen items-center fixed inset-0 z-1000 justify-center bg-background">
      <Logo variant="symbol" color="mono" className="h-10 w-10" />
      <div className="relative">
        <div className="h-1 w-42 bg-secondary rounded-full" />
        <div className="h-1 left-0 top-0 bg-foreground rounded-full absolute animate-[designer-loading_10s_ease-in-out] fill-mode-forwards" />
      </div>
    </div>
  );
}

/** Store-free error screen for terminal transport/token failures. */
function ErrorScreen({ retry }: { error: Error; retry: () => void }) {
  return (
    <div className="flex h-screen flex-col gap-6 w-screen items-center fixed inset-0 z-1000 justify-center bg-background">
      <Logo variant="symbol" color="mono" className="h-10 w-10" />
      <div className="flex flex-col items-center gap-2">
        <p className="text-sm font-medium text-foreground">Could not connect to the editor</p>
        <p className="text-sm text-muted-foreground">
          The editing session could not be established.
        </p>
      </div>
      <button
        type="button"
        onClick={retry}
        className="rounded-md border border-border bg-secondary px-4 py-2 text-sm font-medium text-foreground hover:bg-secondary/80"
      >
        Retry
      </button>
    </div>
  );
}

/**
 * Gates the designer on document readiness: pre-ready, the document has no
 * snapshot and writes throw, so nothing snapshot-consuming may mount. The
 * loading overlay lingers briefly after readiness for a smooth reveal.
 */
function DesignerReadyGate({ children }: { children: React.ReactNode }) {
  const store = usePaywallDesignerStore();
  const isReady = useStore(store, (state) => state.mimic.isReady);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    if (!isReady) {
      return;
    }
    const timer = setTimeout(() => {
      setRevealed(true);
    }, 200);
    return () => {
      clearTimeout(timer);
    };
  }, [isReady]);

  return (
    <>
      {!revealed && <LoadingScreen />}
      {isReady && children}
    </>
  );
}

export function DesignerDetailPage({ paywallId }: { paywallId: string }) {
  return (
    <PaywallDesignerStoreProvider
      paywallId={paywallId}
      renderLoading={() => <LoadingScreen />}
      renderError={(error, retry) => <ErrorScreen error={error} retry={retry} />}
    >
      <DesignerReadyGate>
        <DesignerContent />
      </DesignerReadyGate>
    </PaywallDesignerStoreProvider>
  );
}
