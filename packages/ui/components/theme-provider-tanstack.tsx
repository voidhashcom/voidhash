"use client";

import * as R from "effect/Record";
import * as P from "effect/Predicate";
import * as HashSet from "effect/HashSet";
import * as Option from "effect/Option";

/*
  This file is adapted from next-themes to work with tanstack start.
  next-themes can be found at https://github.com/pacocoursey/next-themes under the MIT license.
*/

import * as Effect from "effect/Effect";
import * as EffectRuntime from "effect/Effect";
import * as React from "react";
import * as Schema from "effect/Schema";
const effectEncodeJson = Schema.encodeSync(Schema.UnknownFromJsonString);

interface ValueObject {
  [themeName: string]: string;
}

export interface UseThemeProps {
  /** List of all available theme names */
  themes: string[];
  /** Forced theme name for the current page */
  forcedTheme?: string;
  /** Update the theme */
  setTheme: React.Dispatch<React.SetStateAction<string>>;
  /** Active theme name */
  theme?: string;
  /** If enableSystem is true, returns the System theme preference ("dark" or "light"), regardless what the active theme is */
  systemTheme?: "dark" | "light";
}

export type Attribute = `data-${string}` | "class";

export interface ThemeProviderProps extends React.PropsWithChildren {
  /** List of all available theme names */
  themes?: string[];
  /** Forced theme name for the current page */
  forcedTheme?: string;
  /** Whether to switch between dark and light themes based on prefers-color-scheme */
  enableSystem?: boolean;
  /** Disable all CSS transitions when switching themes */
  disableTransitionOnChange?: boolean;
  /** Whether to indicate to browsers which color scheme is used (dark or light) for built-in UI like inputs and buttons */
  enableColorScheme?: boolean;
  /** Key used to store theme setting in localStorage */
  storageKey?: string;
  /** Default theme name (for v0.0.12 and lower the default was light). If `enableSystem` is false, the default theme is light */
  defaultTheme?: string;
  /** HTML attribute modified based on the active theme. Accepts `class`, `data-*` (meaning any data attribute, `data-mode`, `data-color`, etc.), or an array which could include both */
  attribute?: Attribute | Attribute[];
  /** Mapping of theme name to HTML attribute value. Object where key is the theme name and value is the attribute value */
  value?: ValueObject;
  /** Nonce string to pass to the inline script for CSP headers */
  nonce?: string;
}

const colorSchemes = HashSet.make("light", "dark");
const MEDIA = "(prefers-color-scheme: dark)";
const isServer = P.isUndefined(globalThis.window);
const defaultContext: UseThemeProps = { setTheme: (_) => {}, themes: [] };
const ThemeContext = React.createContext<Option.Option<UseThemeProps>>(Option.none());

export const useTheme = () =>
  Option.getOrElse(React.useContext(ThemeContext), () => defaultContext);

export const ThemeProviderTanstack = (
  props: ThemeProviderProps & { suppressHydrationWarning?: boolean },
): React.ReactNode => {
  const context = React.useContext(ThemeContext);

  // Ignore nested context providers, just passthrough children
  if (Option.isSome(context)) {
    return props.children;
  }
  return <Theme {...props} />;
};

const defaultThemes = ["light", "dark"];

const Theme = ({
  forcedTheme,
  disableTransitionOnChange = false,
  enableSystem = true,
  enableColorScheme = true,
  storageKey = "theme",
  themes = defaultThemes,
  defaultTheme = enableSystem ? "system" : "light",
  attribute = "data-theme",
  value,
  children,
  nonce,
}: ThemeProviderProps) => {
  const [theme, setThemeState] = React.useState(() => getTheme(storageKey, defaultTheme));
  const attrs = value ? R.values(value) : themes;

  // apply selected theme function (light, dark, system)
  const applyTheme = React.useCallback((theme?: string) => {
    let resolved = theme;
    if (!resolved) {
      return;
    }

    // If theme is system, resolve it before setting theme
    if (theme === "system" && enableSystem) {
      resolved = getSystemTheme();
    }

    const name = value ? value[resolved] : resolved;
    const enable = disableTransitionOnChange ? disableAnimation() : null;
    const d = document.documentElement;

    const handleAttribute = (attr: Attribute) => {
      if (attr === "class") {
        d.classList.remove(...attrs);
        if (name) {
          d.classList.add(name);
        }
      } else if (attr.startsWith("data-")) {
        if (name) {
          d.setAttribute(attr, name);
        } else {
          d.removeAttribute(attr);
        }
      }
    };

    if (Array.isArray(attribute)) {
      attribute.forEach(handleAttribute);
    } else {
      handleAttribute(attribute);
    }

    if (enableColorScheme) {
      const fallback = HashSet.has(colorSchemes, defaultTheme) ? defaultTheme : null;
      const colorScheme = HashSet.has(colorSchemes, resolved) ? resolved : fallback;
      d.style.colorScheme = colorScheme ?? "";
    }

    enable?.();
  }, []);

  // Set theme state and save to local storage
  const setTheme = React.useCallback(
    (value: any) => {
      const newTheme = P.isFunction(value) ? value(theme) : value;
      setThemeState(newTheme);

      // Save to storage (unsupported / blocked storage is ignored)
      EffectRuntime.runSync(
        Effect.ignore(
          Effect.try(() => {
            localStorage.setItem(storageKey, newTheme);
          }),
        ),
      );
    },
    [theme],
  );

  const handleMediaQuery = React.useCallback(
    (e: MediaQueryListEvent | MediaQueryList) => {
      getSystemTheme(e);

      if (theme === "system" && enableSystem && !forcedTheme) {
        applyTheme("system");
      }
    },
    [theme, forcedTheme],
  );

  // Always listen to System preference
  React.useEffect(() => {
    const media = window.matchMedia(MEDIA);

    // Intentionally use deprecated listener methods to support iOS & old browsers
    media.addListener(handleMediaQuery);
    handleMediaQuery(media);

    return () => media.removeListener(handleMediaQuery);
  }, [handleMediaQuery]);

  // localStorage event handling, allow to sync theme changes between tabs
  React.useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key !== storageKey) {
        return;
      }

      // If default theme set, use it if localstorage === null (happens on local storage manual deletion)
      const theme = e.newValue || defaultTheme;
      setTheme(theme);
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [setTheme]);

  // Whenever theme or forcedTheme changes, apply it
  React.useEffect(() => {
    applyTheme(forcedTheme ?? theme);
  }, [forcedTheme, theme]);

  const providerValue = React.useMemo(
    () => ({
      forcedTheme,
      setTheme,
      theme,
      themes: enableSystem ? [...themes, "system"] : themes,
    }),
    [theme, setTheme, forcedTheme, enableSystem, themes],
  );

  return (
    <ThemeContext.Provider value={Option.some(providerValue)}>
      <ThemeScript
        {...{
          attribute,
          defaultTheme,
          enableColorScheme,
          enableSystem,
          forcedTheme,
          nonce,
          storageKey,
          themes,
          value,
        }}
      />
      {children}
    </ThemeContext.Provider>
  );
};

const ThemeScript = React.memo(
  ({
    forcedTheme,
    storageKey,
    attribute,
    enableSystem,
    enableColorScheme,
    defaultTheme,
    value,
    themes,
    nonce,
  }: Omit<ThemeProviderProps, "children"> & { defaultTheme: string }) => {
    const scriptArgs = effectEncodeJson([
      attribute,
      storageKey,
      defaultTheme,
      forcedTheme,
      themes,
      value,
      enableSystem,
      enableColorScheme,
    ]).slice(1, -1);

    return (
      <script
        // Needed to inject script before hydration
        dangerouslySetInnerHTML={{
          __html: `(${script.toString()})(${scriptArgs})`,
        }}
        nonce={P.isUndefined(globalThis.window) ? nonce : ""}
        // Needed to inject script before hydration
        suppressHydrationWarning
      />
      // <></>
    );
  },
);

// Helpers
const getTheme = (key: string, fallback?: string) => {
  if (isServer) {
    return;
  }
  // Unsupported / blocked storage reads as absent.
  const theme = EffectRuntime.runSync(
    Effect.try(() => localStorage.getItem(key) || undefined).pipe(
      Effect.orElseSucceed(() => undefined),
    ),
  );
  return theme || fallback;
};

const disableAnimation = () => {
  const css = document.createElement("style");
  css.append(
    document.createTextNode(
      "*,*::before,*::after{-webkit-transition:none!important;-moz-transition:none!important;-o-transition:none!important;-ms-transition:none!important;transition:none!important}",
    ),
  );
  document.head.append(css);

  return () => {
    // Force restyle
    (() => window.getComputedStyle(document.body))();

    // Wait for next tick before removing
    setTimeout(() => {
      document.head.removeChild(css);
    }, 1);
  };
};

const getSystemTheme = (e?: MediaQueryList | MediaQueryListEvent) => {
  const event = e ?? window.matchMedia(MEDIA);
  const isDark = event.matches;
  const systemTheme = isDark ? "dark" : "light";
  return systemTheme;
};

/*
  This file is adapted from next-themes to work with tanstack start.
  next-themes can be found at https://github.com/pacocoursey/next-themes under the MIT license.
*/

type ThemeScriptArgs = [
  attribute: Attribute,
  storageKey: string,
  defaultTheme: string,
  forcedTheme?: string,
  themes?: string[],
  value?: ValueObject,
  enableSystem?: boolean,
  enableColorScheme?: boolean,
];

export const script = (
  ...[
    attribute,
    storageKey,
    defaultTheme,
    forcedTheme,
    themes = [],
    value,
    enableSystem,
    enableColorScheme,
  ]: ThemeScriptArgs
): void => {
  const el = document.documentElement;
  const systemThemes = ["light", "dark"];
  const isClass = attribute === "class";
  const classes = isClass && value ? themes.map((theme) => value[theme] || theme) : themes;

  function updateDOM(theme: string) {
    if (isClass) {
      el.classList.remove(...classes);
      el.classList.add(theme);
    } else {
      el.setAttribute(attribute, theme);
    }

    setColorScheme(theme);
  }

  function setColorScheme(theme: string) {
    if (enableColorScheme && systemThemes.includes(theme)) {
      el.style.colorScheme = theme;
    }
  }

  function getSystemTheme() {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }

  if (forcedTheme) {
    updateDOM(forcedTheme);
  } else {
    const themeName = localStorage.getItem(storageKey) || defaultTheme;
    const isSystem = enableSystem && themeName === "system";
    const theme = isSystem ? getSystemTheme() : themeName;
    updateDOM(theme);
  }
};
