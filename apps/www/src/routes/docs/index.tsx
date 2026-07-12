import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/docs/")({
  beforeLoad: () => {
    throw redirect({
      params: {
        _splat: "introduction",
      },
      to: "/docs/$",
    });
  },
  component: () => null,
});
