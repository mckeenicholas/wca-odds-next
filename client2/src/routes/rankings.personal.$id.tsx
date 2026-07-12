import { Show } from "solid-js";
import { createFileRoute } from "@tanstack/solid-router";
import { PersonalRankingsList } from "../components/custom/PersonalRankingsList";
import { usePersonalRankings } from "../lib/PersonalRankingsContext";

interface PersonalSearch {
  date?: string;
}

export const Route = createFileRoute("/rankings/personal/$id")({
  component: PersonalRankingsDetail,
  validateSearch: (search: Record<string, unknown>): PersonalSearch => {
    const result: PersonalSearch = {};
    if (typeof search.date === "string") {
      result.date = search.date;
    }
    return result;
  },
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
