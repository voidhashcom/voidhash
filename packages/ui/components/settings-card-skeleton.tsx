import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { Skeleton } from "./ui/skeleton";

export function SettingsCardSkeleton({
  description = true,
  footer = true,
  content = false,
  instructions = true,
  action = true,
}: {
  description?: boolean;
  footer?: boolean;
  content?: boolean;
  instructions?: boolean;
  action?: boolean;
}) {
  return (
    <Card className="mt-8 overflow-hidden pb-0">
      <CardHeader>
        <CardTitle>
          <Skeleton className="h-4 w-32" />
        </CardTitle>
        {description && (
          <CardDescription>
            <Skeleton className="h-4 w-48" />
          </CardDescription>
        )}
      </CardHeader>
      {content && (
        <CardContent>
          <Skeleton className="h-4 w-64" />
        </CardContent>
      )}
      {footer && (
        <CardFooter className="flex items-center justify-between border-border border-t bg-background py-3 [.border-t]:pt-3">
          <div>{instructions && <Skeleton className="h-4 w-24" />}</div>
          {action && (
            <div>
              <Skeleton className="h-8 w-20" />
            </div>
          )}
        </CardFooter>
      )}
    </Card>
  );
}
