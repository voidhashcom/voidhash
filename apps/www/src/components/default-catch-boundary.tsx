import type { ErrorComponentProps } from "@tanstack/react-router";
import { ErrorComponent, Link, rootRouteId, useMatch, useRouter } from "@tanstack/react-router";
import { Button } from "@voidhash/ui";

export function DefaultCatchBoundary({ error }: ErrorComponentProps) {
  const router = useRouter();
  const isRoot = useMatch({
    select: (state) => state.id === rootRouteId,
    strict: false,
  });

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-4">
      <ErrorComponent error={error} />
      <div className="flex flex-wrap items-center gap-2">
        <Button
          onClick={() => {
            void router.invalidate();
          }}
          variant="outline"
        >
          Try Again
        </Button>
        {isRoot ? (
          <Button asChild>
            <Link to="/">Home</Link>
          </Button>
        ) : (
          <Button
            onClick={(event) => {
              event.preventDefault();
              window.history.back();
            }}
            variant="outline"
          >
            Go Back
          </Button>
        )}
      </div>
    </div>
  );
}
