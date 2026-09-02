import { useTheme } from "next-themes";
import type { CSSProperties } from "react";
import { Toaster as Sonner, type ToasterProps } from "sonner";

const TOASTER_STYLE: CSSProperties & Partial<Record<`--${string}`, string>> = {
  "--normal-bg": "var(--popover)",
  "--normal-border": "var(--border)",
  "--normal-text": "var(--popover-foreground)",
};

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();
  const toasterTheme: ToasterProps["theme"] =
    theme === "light" || theme === "dark" || theme === "system" ? theme : "system";

  return <Sonner className="toaster group" style={TOASTER_STYLE} theme={toasterTheme} {...props} />;
};

export { Toaster };
