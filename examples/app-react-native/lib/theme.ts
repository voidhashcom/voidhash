import { useColorScheme } from "react-native";

export interface Theme {
  accent: string;
  accentText: string;
  background: string;
  border: string;
  card: string;
  danger: string;
  mutedText: string;
  positive: string;
  subtleBackground: string;
  text: string;
  warning: string;
}

const light: Theme = {
  accent: "#0B63F6",
  accentText: "#FFFFFF",
  background: "#F6F6F7",
  border: "#E2E2E5",
  card: "#FFFFFF",
  danger: "#C2321F",
  mutedText: "#6B6B72",
  positive: "#1B7F4B",
  subtleBackground: "#EDEDF0",
  text: "#111113",
  warning: "#8A5A00",
};

const dark: Theme = {
  accent: "#4C8DFF",
  accentText: "#0A0A0B",
  background: "#0A0A0B",
  border: "#232326",
  card: "#131315",
  danger: "#FF6B58",
  mutedText: "#9A9AA1",
  positive: "#57C98A",
  subtleBackground: "#1B1B1E",
  text: "#F4F4F5",
  warning: "#E0A93A",
};

/** Palette for the active system color scheme. Re-renders when the user flips dark mode. */
export function useTheme(): Theme {
  return useColorScheme() === "dark" ? dark : light;
}
