import { createFileRoute, redirect } from "@tanstack/react-router"

export const Route = createFileRoute("/_layout/admin/migration-jobs")({
  beforeLoad: () => {
    throw redirect({ to: "/jobs" })
  },
})
