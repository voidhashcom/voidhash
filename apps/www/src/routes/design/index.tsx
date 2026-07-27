import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/design/")({
  beforeLoad: () => {
    throw redirect({
      params: {
        _splat: "components/overview",
      },
      to: "/design/$",
    });
  },
  component: () => null,
});
