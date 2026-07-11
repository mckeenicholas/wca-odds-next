import { createFileRoute } from "@tanstack/solid-router";

export const Route = createFileRoute("/rankings/personal/$id")({
  component: PersonalRankingsPageWithId,
});

function PersonalRankingsPageWithId() {
  const params = Route.useParams();

  return (
    <div class="p-6">
      <h1 class="text-2xl font-bold">Personal Rankings for {params().id}</h1>
      <p class="mt-2 text-muted-foreground">
        This is a placeholder for the personal rankings page with a specific competitor ID.
      </p>
    </div>
  );
}
