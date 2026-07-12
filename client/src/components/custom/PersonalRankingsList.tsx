import type { PersonRankInfo, PersonSearchResult } from "../../lib/types";
import { For, Show, Index } from "solid-js";
import { Skeleton } from "../ui/skeleton";
import { EventRankDropdown } from "./EventRankDropdown";

interface PersonalRankingsListProps {
  selectedPerson: PersonSearchResult;
  committedDate: Date;
  isPending: boolean;
  data: PersonRankInfo[] | undefined;
}

export function PersonalRankingsList(props: PersonalRankingsListProps) {
  return (
    <section class="mt-6 w-full">
      <Show
        when={!props.isPending || Boolean(props.data && props.data.length > 0)}
        fallback={
          <div class="space-y-4 rounded-md border p-4">
            <Index each={Array.from({ length: 8 })}>{() => <Skeleton class="h-9 w-full" />}</Index>
          </div>
        }
      >
        <Show
          when={props.data && props.data.length > 0}
          fallback={
            <div class="mt-12 text-center text-muted-foreground">
              <p class="text-lg">{props.selectedPerson.name}</p>
              <p class="text-sm">No competition data found for this timeframe.</p>
            </div>
          }
        >
          <div class="rounded-md border shadow-sm">
            <header class="flex items-center justify-between px-4 py-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              <span class="w-16 md:w-28">Rank</span>
              <span class="flex-1">Event</span>
              <span class="w-24 text-right">Score</span>
              <span class="w-8" />
            </header>
            <ol class="border-t">
              <For each={props.data}>
                {(eventRank, index) => (
                  <li class="p-1">
                    <EventRankDropdown
                      eventRank={eventRank}
                      personId={props.selectedPerson.person_id}
                      personName={props.selectedPerson.name}
                      rankDate={props.committedDate}
                      index={index()}
                    />
                  </li>
                )}
              </For>
            </ol>
          </div>
        </Show>
      </Show>
    </section>
  );
}
