import { createFileRoute } from "@tanstack/solid-router";

export const Route = createFileRoute("/rankings/")({
  component: RankingsPage,
});

function RankingsPage() {
  return (
    <div class="p-6">
      <h1 class="text-2xl font-bold">Global Rankings</h1>
      <p class="mt-2 text-muted-foreground">This is a placeholder for the global rankings page.</p>
    </div>
  );
}
