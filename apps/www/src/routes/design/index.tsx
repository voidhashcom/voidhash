import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/design/")({
  beforeLoad: () => {
    throw redirect({
      params: {
        _splat: "introduction",
      },
      to: "/design/$",
    });
  },
  component: () => null,
});
