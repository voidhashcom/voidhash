import { cn } from "@voidhash/ui";

export function CheckerboardBackground({ className }: { className?: string }) {
  return (
    <div
      className={cn("pointer-events-none absolute inset-0", className)}
      style={{
        backgroundImage: `
          linear-gradient(45deg, #808080 25%, transparent 25%),
          linear-gradient(-45deg, #808080 25%, transparent 25%),
          linear-gradient(45deg, transparent 75%, #808080 75%),
          linear-gradient(-45deg, transparent 75%, #808080 75%)
        `,
        backgroundPosition: "0 0, 0 4px, 4px -4px, -4px 0",
        backgroundSize: "8px 8px",
      }}
    />
  );
}
