import { createFileRoute, redirect } from "@tanstack/react-router";
import { Effect } from "effect";

export const Route = createFileRoute("/_app/_layout/")({
  beforeLoad: () =>
    // TanStack Router signals navigation by a thrown redirect; `runSync` on a
    // defect rethrows the redirect object verbatim so the router still sees it.
    Effect.runSync(Effect.die(redirect({ to: "/databases" }))),
});
