"use client";

import { lazy, Suspense, useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";

import { cn } from "@/lib/utils";

import { VoidhashGradientControls } from "./voidhash-gradient-controls";
import {
  DEFAULT_VOIDHASH_GRADIENT_SETTINGS,
  mergeVoidhashGradientSettings,
  VOIDHASH_GRADIENT_CONTROLS_STORAGE_KEY,
  VOIDHASH_GRADIENT_STORAGE_KEY,
  type VoidhashGradientSettings,
} from "./voidhash-gradient-settings";

const VoidhashGradientCanvas = lazy(async () => {
  const module = await import("./voidhash-gradient-canvas");

  return {
    default: module.VoidhashGradientCanvas,
  };
});

type VoidhashGradientPlacement = "bottom" | "top";
type ReadyPlacements = Record<VoidhashGradientPlacement, boolean>;

function getFadeMask(settings: VoidhashGradientSettings, placement: VoidhashGradientPlacement) {
  const start = Math.min(settings.fadeStart, settings.fadeEnd - 1);
  const end = Math.max(settings.fadeEnd, start + 1);
  const mid = start + (end - start) * 0.35;
  const direction = placement === "top" ? "to top" : "to bottom";

  return `linear-gradient(${direction}, transparent 0%, transparent ${start}%, rgba(0, 0, 0, 0.12) ${mid}%, black ${end}%, black 100%)`;
}

function getLayerStyle(settings: VoidhashGradientSettings, placement: VoidhashGradientPlacement): CSSProperties {
  return {
    [placement]: `${placement === "top" ? settings.topOffset : settings.bottomOffset}%`,
    filter: `blur(${settings.blur}px)`,
    height: `${settings.effectHeight}%`,
    maskImage: getFadeMask(settings, placement),
    WebkitMaskImage: getFadeMask(settings, placement),
  };
}

function VoidhashGradientEntryVeil({ isVisible }: { isVisible: boolean }) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-0 z-20 bg-black transition-opacity duration-1000 ease-out motion-reduce:transition-none",
        isVisible ? "opacity-100" : "opacity-0",
      )}
    />
  );
}

function VoidhashGradientLayer({
  isRevealed,
  onReady,
  placement,
  settings,
}: {
  isRevealed: boolean;
  onReady: (placement: VoidhashGradientPlacement) => void;
  placement: VoidhashGradientPlacement;
  settings: VoidhashGradientSettings;
}) {
  const [isCanvasReady, setIsCanvasReady] = useState(false);

  return (
    <div aria-hidden className="absolute inset-x-[-10%] overflow-hidden" style={getLayerStyle(settings, placement)}>
      <div
        className={cn(
          "absolute inset-0 transition-[opacity,transform] duration-1000 ease-out will-change-[opacity,transform]",
          isCanvasReady && isRevealed ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0",
        )}
      >
        <VoidhashGradientCanvas
          inverted={placement === "top"}
          onReady={() => {
            setIsCanvasReady(true);
            onReady(placement);
          }}
          seed={placement === "top" ? settings.topSeed : settings.bottomSeed}
          settings={settings}
        />
      </div>
    </div>
  );
}

export type VoidhashGradientBackgroundProps = {
  className?: string;
  controlsQueryParam?: string;
  controlsStorageKey?: string;
  controlsTitle?: string;
  settings?: Partial<VoidhashGradientSettings>;
  settingsStorageKey?: string;
};

/** Renders the reusable blurred Three.js gradient background used across Voidhash surfaces. */
export function VoidhashGradientBackground({
  className,
  controlsQueryParam = "gradientControls",
  controlsStorageKey = VOIDHASH_GRADIENT_CONTROLS_STORAGE_KEY,
  controlsTitle = "Gradient FX",
  settings: settingsProp,
  settingsStorageKey = VOIDHASH_GRADIENT_STORAGE_KEY,
}: VoidhashGradientBackgroundProps) {
  const baseSettings = useMemo(
    () => mergeVoidhashGradientSettings(settingsProp ?? DEFAULT_VOIDHASH_GRADIENT_SETTINGS),
    [settingsProp],
  );
  const [isMounted, setIsMounted] = useState(false);
  const [canDropEntryVeil, setCanDropEntryVeil] = useState(false);
  const [hasRevealed, setHasRevealed] = useState(false);
  const [readyPlacements, setReadyPlacements] = useState<ReadyPlacements>({ bottom: false, top: false });
  const [settings, setSettings] = useState<VoidhashGradientSettings>(baseSettings);
  const [showControls, setShowControls] = useState(false);

  useEffect(() => {
    setIsMounted(true);

    const params = new URLSearchParams(window.location.search);
    const controlsEnabled = params.has(controlsQueryParam) || localStorage.getItem(controlsStorageKey) === "1";
    const savedSettings = localStorage.getItem(settingsStorageKey);

    if (savedSettings) {
      try {
        setSettings(mergeVoidhashGradientSettings(JSON.parse(savedSettings), baseSettings));
      } catch {
        localStorage.removeItem(settingsStorageKey);
      }
    }

    if (controlsEnabled) {
      setShowControls(true);
      localStorage.setItem(controlsStorageKey, "1");
    }
  }, [baseSettings, controlsQueryParam, controlsStorageKey, settingsStorageKey]);

  useEffect(() => {
    if (!isMounted) {
      return;
    }

    const veilTimer = window.setTimeout(() => setCanDropEntryVeil(true), 1800);

    return () => window.clearTimeout(veilTimer);
  }, [isMounted]);

  useEffect(() => {
    if (isMounted && showControls) {
      localStorage.setItem(settingsStorageKey, JSON.stringify(settings));
    }
  }, [isMounted, settings, settingsStorageKey, showControls]);

  const handleLayerReady = useCallback((placement: VoidhashGradientPlacement) => {
    setReadyPlacements((current) => {
      if (current[placement]) {
        return current;
      }

      return { ...current, [placement]: true };
    });
  }, []);

  const isShaderReady = readyPlacements.bottom && (!settings.topEnabled || readyPlacements.top);

  useEffect(() => {
    if (!hasRevealed && isMounted && (isShaderReady || canDropEntryVeil)) {
      setHasRevealed(true);
    }
  }, [canDropEntryVeil, hasRevealed, isMounted, isShaderReady]);

  const rootClassName = cn("relative isolate h-full w-full overflow-hidden bg-black", className);

  if (!isMounted) {
    return (
      <div className={rootClassName}>
        <VoidhashGradientEntryVeil isVisible={!hasRevealed} />
      </div>
    );
  }

  return (
    <div className={rootClassName}>
      <Suspense fallback={null}>
        <VoidhashGradientLayer
          isRevealed={hasRevealed}
          onReady={handleLayerReady}
          placement="bottom"
          settings={settings}
        />
        {settings.topEnabled ? (
          <VoidhashGradientLayer
            isRevealed={hasRevealed}
            onReady={handleLayerReady}
            placement="top"
            settings={settings}
          />
        ) : null}
      </Suspense>
      <VoidhashGradientEntryVeil isVisible={!hasRevealed} />

      {showControls ? (
        <VoidhashGradientControls
          onChange={setSettings}
          onHide={() => {
            setShowControls(false);
            localStorage.removeItem(controlsStorageKey);
          }}
          onReset={() => {
            setSettings(baseSettings);
            localStorage.removeItem(settingsStorageKey);
          }}
          settings={settings}
          title={controlsTitle}
        />
      ) : null}
    </div>
  );
}
