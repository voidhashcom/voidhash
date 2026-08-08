import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/docs/")({
  beforeLoad: () => {
    // oxlint-disable-next-line effect/noThrowStatement -- `throw redirect(...)` is TanStack Router's control-flow contract for route guards; the router catches the thrown redirect, so it cannot be modelled as a tagged error.
    throw redirect({
      params: {
        _splat: "introduction",
      },
      to: "/docs/$",
    });
  },
  component: () => null,
});
