"use client";

import { CheckIcon, CopyIcon } from "lucide-react";
import { useCallback, useState } from "react";

import { cn } from "@/features/design/lib/cn";

import {
  BRAND_SCALES,
  isLightColor,
  resolveToken,
  scaleSteps,
  SEMANTIC_GROUPS,
  type SemanticToken,
  type ThemeName,
} from "./tokens";

const THEMES: ThemeName[] = ["light", "dark"];

const useCopyValue = () => {
  const [copied, setCopied] = useState<string | undefined>(undefined);

  const copy = useCallback((value: string) => {
    void navigator.clipboard.writeText(value).then(() => {
      setCopied(value);
      setTimeout(() => setCopied((current) => (current === value ? undefined : current)), 1200);
    });
  }, []);

  return { copied, copy };
};

interface CopyButtonProps {
  className?: string;
  copied: boolean;
  label: string;
  onCopy: () => void;
  value: string;
}

function CopyButton({ className, copied, label, onCopy, value }: CopyButtonProps) {
  return (
    <button
      className={cn(
        "group inline-flex items-center gap-1.5 rounded-sm font-mono text-xs transition-colors hover:text-foreground",
        className,
      )}
      onClick={onCopy}
      title={`Copy ${label}`}
      type="button"
    >
      <span>{value}</span>
      {copied ? (
        <CheckIcon className="size-3 text-success" />
      ) : (
        <CopyIcon className="size-3 opacity-0 transition-opacity group-hover:opacity-60" />
      )}
    </button>
  );
}

interface TokenSwatchProps {
  theme: ThemeName;
  token: SemanticToken;
}

function TokenSwatch({ theme, token }: TokenSwatchProps) {
  const resolved = resolveToken(token.name, theme);
  if (!resolved) {
    return null;
  }

  const on = token.on ? resolveToken(token.on, theme) : undefined;
  const fallbackText = isLightColor(resolved.value) ? "oklch(0% 0 0)" : "oklch(100% 0 0)";

  return (
    <div
      className="flex h-16 flex-1 items-center justify-center"
      style={{ backgroundColor: resolved.value }}
    >
      <span
        className="font-medium text-sm"
        style={{ color: on?.value ?? fallbackText, opacity: token.on ? 1 : 0.55 }}
      >
        {token.on ? "Aa" : theme === "light" ? "L" : "D"}
      </span>
    </div>
  );
}

interface TokenValueProps {
  copiedValue: string | undefined;
  onCopy: (value: string) => void;
  theme: ThemeName;
  token: SemanticToken;
}

function TokenValue({ copiedValue, onCopy, theme, token }: TokenValueProps) {
  const resolved = resolveToken(token.name, theme);
  if (!resolved) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-muted-foreground text-xs">
      <span className="w-9 shrink-0 uppercase tracking-wide">{theme}</span>
      <CopyButton
        copied={copiedValue === resolved.value}
        label={`${theme} value`}
        onCopy={() => onCopy(resolved.value)}
        value={resolved.value}
      />
      {resolved.alias ? <span className="opacity-70">via {resolved.alias}</span> : null}
    </div>
  );
}

interface SemanticTokenCardProps {
  copiedValue: string | undefined;
  onCopy: (value: string) => void;
  token: SemanticToken;
}

function SemanticTokenCard({ copiedValue, onCopy, token }: SemanticTokenCardProps) {
  const variable = `var(--${token.name})`;

  return (
    <div className="flex flex-col overflow-hidden rounded-lg border bg-card">
      <div className="flex">
        {THEMES.map((theme) => (
          <TokenSwatch key={theme} theme={theme} token={token} />
        ))}
      </div>

      <div className="flex flex-1 flex-col gap-2 border-t p-3">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <CopyButton
            className="font-medium text-foreground text-sm"
            copied={copiedValue === variable}
            label="variable"
            onCopy={() => onCopy(variable)}
            value={`--${token.name}`}
          />
          {token.on ? (
            <span className="text-muted-foreground text-xs">
              on <span className="font-mono">--{token.on}</span>
            </span>
          ) : null}
        </div>

        <p className="text-muted-foreground text-sm leading-snug">{token.meaning}</p>

        <div className="flex flex-wrap gap-1">
          {token.utilities.map((utility) => (
            <code
              className="rounded-sm bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground"
              key={utility}
            >
              {utility}
            </code>
          ))}
        </div>

        <div className="mt-auto flex flex-col gap-0.5 pt-1">
          {THEMES.map((theme) => (
            <TokenValue
              copiedValue={copiedValue}
              key={theme}
              onCopy={onCopy}
              theme={theme}
              token={token}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Renders every semantic theme token grouped by intent, with its light and dark
 * value, the alias it resolves through, and the Tailwind utilities that map to
 * it. Values are read from `@voidhash/ui/styles/brand-theme.css`, so this page
 * cannot drift from the theme.
 */
export function SemanticColorTokens() {
  const { copied, copy } = useCopyValue();

  return (
    <div className="not-prose flex flex-col gap-10">
      {SEMANTIC_GROUPS.map((group) => (
        <section className="flex flex-col gap-4" key={group.title}>
          <div className="flex flex-col gap-1">
            <h3 className="font-semibold text-lg tracking-tight">{group.title}</h3>
            <p className="max-w-[70ch] text-muted-foreground text-sm">{group.description}</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {group.tokens.map((token) => (
              <SemanticTokenCard
                copiedValue={copied}
                key={token.name}
                onCopy={copy}
                token={token}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

/**
 * Renders the raw brand ramps every semantic token is built from. Scales are
 * theme-independent — only the semantic tokens above remap between light and
 * dark.
 */
export function BrandColorScales() {
  const { copied, copy } = useCopyValue();

  return (
    <div className="not-prose flex flex-col gap-10">
      {BRAND_SCALES.map((scale) => {
        const steps = scaleSteps(scale.prefix);

        return (
          <section className="flex flex-col gap-3" key={scale.prefix}>
            <div className="flex flex-col gap-1">
              <h3 className="font-semibold text-lg tracking-tight">{scale.title}</h3>
              <p className="max-w-[70ch] text-muted-foreground text-sm">{scale.meaning}</p>
            </div>

            <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-11">
              {steps.map((step) => {
                const name = `${scale.prefix}-${step}`;
                const resolved = resolveToken(name, "light");
                if (!resolved) {
                  return null;
                }

                const variable = `var(--${name})`;

                return (
                  <button
                    className="group flex flex-col gap-1.5 text-left"
                    key={step}
                    onClick={() => copy(variable)}
                    title={`Copy ${variable}`}
                    type="button"
                  >
                    <span
                      className="flex h-14 items-center justify-center rounded-md border border-black/5 transition-transform group-hover:scale-[1.03] dark:border-white/10"
                      style={{ backgroundColor: resolved.value }}
                    >
                      {copied === variable ? (
                        <CheckIcon
                          className="size-4"
                          style={{
                            color: isLightColor(resolved.value)
                              ? "oklch(0% 0 0)"
                              : "oklch(100% 0 0)",
                          }}
                        />
                      ) : null}
                    </span>
                    <span className="flex flex-col leading-tight">
                      <span className="font-medium text-xs">{step}</span>
                      <span className="break-all font-mono text-[10px] text-muted-foreground">
                        {resolved.value}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
