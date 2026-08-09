import { Link } from "@tanstack/react-router";
import { Button } from "@voidhash/ui";

export function NotFound({ children }: { children?: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-4">
      <h1 className="text-4xl font-bold">404</h1>
      <div className="text-muted-foreground">
        {children || <p>The page you are looking for does not exist.</p>}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => window.history.back()} variant="outline">
          Go Back
        </Button>
        <Button asChild>
          <Link to="/">Start Over</Link>
        </Button>
      </div>
    </div>
  );
}
