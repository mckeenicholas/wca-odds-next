import { createFileRoute } from "@tanstack/solid-router";

export const Route = createFileRoute("/custom/results")({
  component: CustomResultsPage,
});

function CustomResultsPage() {
  return (
    <div class="p-6">
      <h1 class="text-2xl font-bold">Custom Simulation Results</h1>
      <p class="mt-2 text-muted-foreground">
        This is a placeholder for the custom simulation results page.
      </p>
    </div>
  );
}
