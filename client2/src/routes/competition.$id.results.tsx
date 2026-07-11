import { createFileRoute } from "@tanstack/solid-router";
import { z } from "zod";

const simulationSearchSchema = z.object({
  name: z.string().optional(),
  competitionId: z.string().optional(),
  date: z.string().optional(),
  eventId: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  includeDnf: z.string().optional(),
  decayRate: z.string().optional(),
  competitors: z.string().optional(),
});

export const Route = createFileRoute("/competition/$id/results")({
  validateSearch: (search) => simulationSearchSchema.parse(search),
  component: CompetitionResultsPage,
});

function CompetitionResultsPage() {
  const params = Route.useParams();

  return (
    <div class="p-6">
      <h1 class="text-2xl font-bold">Competition {params().id} Results</h1>
      <p class="mt-2 text-muted-foreground">
        This is a placeholder for the competition simulation results page.
      </p>
    </div>
  );
}
