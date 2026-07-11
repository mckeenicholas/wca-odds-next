import { Show } from "solid-js";
import { createFileRoute } from "@tanstack/solid-router";
import { z } from "zod";
import { PersonalRankingsList } from "../components/custom/PersonalRankingsList";
import { usePersonalRankings } from "../lib/PersonalRankingsContext";

const personalSearchSchema = z.object({
  date: z.string().optional(),
});

export const Route = createFileRoute("/rankings/personal/$id")({
  component: PersonalRankingsDetail,
  validateSearch: (search) => personalSearchSchema.parse(search),
});

function PersonalRankingsDetail() {
  const ctx = usePersonalRankings();

  return (
    <Show when={ctx.selectedPerson() && !ctx.isError()}>
      <PersonalRankingsList
        selectedPerson={ctx.selectedPerson()!}
        committedDate={ctx.committedDate()}
        isPending={ctx.isPending()}
        data={ctx.data()}
      />
    </Show>
  );
}
