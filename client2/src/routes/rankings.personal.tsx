import { createFileRoute } from "@tanstack/solid-router";

export const Route = createFileRoute("/rankings/personal")({
  component: PersonalRankingsPage,
});

function PersonalRankingsPage() {
  return (
    <div class="p-6">
      <h1 class="text-2xl font-bold">Personal Rankings</h1>
      <p class="mt-2 text-muted-foreground">
        This is a placeholder for the personal rankings page.
      </p>
    </div>
  );
}
