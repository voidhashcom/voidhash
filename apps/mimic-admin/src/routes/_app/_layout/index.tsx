import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/_layout/")({
  beforeLoad: () => {
    throw redirect({ to: "/databases" });
  },
});
