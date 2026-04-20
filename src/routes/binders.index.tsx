import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/binders/")({
  component: () => <Navigate to="/binders/$status" params={{ status: "draft" }} />,
});
