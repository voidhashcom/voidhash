import { cn } from "@voidhash/ui";

export const EnvironmentFilterNotification = ({
  message = "You are using test data.",
  className,
  type,
}: {
  message: string;
  className?: string;
  type: "testing" | "shared";
}) => (
  <div
    className={cn(
      "border- border p-4",
      type === "shared" &&
        "border-l-2 border-l-orange-600 bg-card text-card-foreground ",
      type === "testing" &&
        "border-l-2 border-l-primary bg-card text-card-foreground",
      className
    )}
  >
    <div className="mt-1 text-sm">{message}</div>
  </div>
);
