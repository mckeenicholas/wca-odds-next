import { createFileRoute } from "@tanstack/solid-router";
import { z } from "zod";

const simulationSearchSchema = z.object({
  competitionId: z.string().optional(),
  competitors: z.string().optional(),
  date: z.string().optional(),
  decayRate: z.string().optional(),
  endDate: z.string().optional(),
  eventId: z.string().optional(),
  includeDnf: z.string().optional(),
  name: z.string().optional(),
  startDate: z.string().optional(),
});

export const Route = createFileRoute("/competition/$id_/results")({
  component: CompetitionResultsPage,
  validateSearch: (search) => simulationSearchSchema.parse(search),
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
