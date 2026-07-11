import { createFileRoute } from "@tanstack/solid-router";

export const Route = createFileRoute("/custom")({
  component: CustomPage,
});

function CustomPage() {
  return (
    <div class="p-6">
      <h1 class="text-2xl font-bold">Select Competitors Manually</h1>
      <p class="mt-2 text-muted-foreground">
        This is a placeholder for the custom competitors page.
      </p>
    </div>
  );
}
