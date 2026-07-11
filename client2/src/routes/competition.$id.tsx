import { createFileRoute, useNavigate } from "@tanstack/solid-router";
import { createQuery } from "@tanstack/solid-query";
import { createSignal, createEffect, onMount, onCleanup, For, Show } from "solid-js";
import { compSettingsStore } from "../lib/stores/compSettings";
import { getCompetitorData } from "../lib/useCompetitionData";
import { fetchWCIF, buildSimulationQuery, BREAKPOINT, cn } from "../lib/utils";
import { ControlPanel } from "../components/custom/ControlPanel";
import { CompetitorLink } from "../components/custom/CompetitorLink";
import { LoadingMessage } from "../components/custom/LoadingMessage";
import { WCALogo } from "../components/custom/WCALogo";
import { Checkbox } from "../components/ui/checkbox";

export const Route = createFileRoute("/competition/$id")({
  component: CompetitionPage,
});

function CompetitionPage() {
  const params = Route.useParams();
  const navigate = useNavigate();

  const query = createQuery(() => ({
    queryKey: ["competition", params().id],
    queryFn: () => fetchWCIF(params().id),
    staleTime: Infinity,
  }));

  // Sync route params with store
  createEffect(() => {
    const id = params().id;
    if (id && id !== compSettingsStore.compId()) {
      compSettingsStore.reset();
      compSettingsStore.setCompId(id);
    }
  });

  const eventIds = () =>
    query.data?.events.map((event) => event.id).filter((id) => id !== ("333mbf" as any)) ?? [];

  // Populate competitors data once API loads
  createEffect(() => {
    const d = query.data;
    if (d && Object.keys(compSettingsStore.competitorsByEvent()).length === 0) {
      const dataMap = getCompetitorData(
        d,
        query.isError,
        compSettingsStore.selectedEventId(),
        compSettingsStore.setSelectedEventId,
      );
      compSettingsStore.setCompetitorsByEvent(dataMap);
    }
  });

  const currentSelectedCompetitors = () => {
    const list = compSettingsStore.competitorsByEvent()[compSettingsStore.selectedEventId()];
    return list?.filter((competitor) => competitor.selected) ?? [];
  };

  const toggleCompetitor = (competitorId: string) => {
    const currentEvent = compSettingsStore.selectedEventId();
    const currentList = compSettingsStore.competitorsByEvent()[currentEvent];
    if (!currentList) return;

    const newList = currentList.map((c) =>
      c.id === competitorId ? { ...c, selected: !c.selected } : c,
    );

    compSettingsStore.setCompetitorsByEvent({
      ...compSettingsStore.competitorsByEvent(),
      [currentEvent]: newList,
    });
  };

  const [windowWidth, setWindowWidth] = createSignal(
    typeof window !== "undefined" ? window.innerWidth : 1200,
  );

  onMount(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    onCleanup(() => window.removeEventListener("resize", handleResize));
  });

  const runSimulation = () => {
    const d = query.data;
    if (!d) return;

    const selectedIds = currentSelectedCompetitors().map((item) => item.id);
    const startD = compSettingsStore.startDate();
    const endD = compSettingsStore.endDate();

    if (!startD || !endD) return;

    const queryParams = buildSimulationQuery({
      competitionId: d.id,
      competitors: selectedIds,
      date: d.schedule.startDate,
      decayRate: compSettingsStore.decayHalfLife(),
      endDate: endD,
      eventId: compSettingsStore.selectedEventId(),
      includeDnf: compSettingsStore.includeDnf(),
      name: d.name,
      startDate: startD,
    });

    navigate({
      to: `/competition/${d.id}/results`,
      search: queryParams,
    });
  };

  return (
    <div class="flex w-full flex-col items-center justify-center p-4">
      <Show
        when={!query.isPending}
        fallback={<LoadingMessage message="Loading WCA Data" class="text-2xl" />}
      >
        <Show
          when={!query.isError && query.data?.name}
          fallback={
            <div class="text-red-500">
              Error fetching data: {query.error?.message || "Unknown error occurred"}
            </div>
          }
        >
          <h1 class="mb-4 text-center text-2xl leading-snug font-bold flex items-center justify-center gap-2">
            {query.data!.name}
            <a
              href={`https://www.worldcubeassociation.org/competitions/${query.data!.id}`}
              target="_blank"
              rel="noopener noreferrer"
              class="inline-flex align-[-0.125em]"
            >
              <WCALogo class="h-6 w-6" />
            </a>
          </h1>
          <div class="w-full max-w-5xl">
            <ControlPanel
              eventIds={eventIds()}
              selectedEventId={compSettingsStore.selectedEventId()}
              onSelectedEventIdChange={compSettingsStore.setSelectedEventId}
              includeDnf={compSettingsStore.includeDnf()}
              onIncludeDnfChange={compSettingsStore.setIncludeDnf}
              decayRate={compSettingsStore.decayHalfLife()}
              onDecayRateChange={compSettingsStore.setDecayHalfLife}
              startDate={compSettingsStore.startDate()}
              onStartDateChange={compSettingsStore.setStartDate}
              endDate={compSettingsStore.endDate()}
              onEndDateChange={compSettingsStore.setEndDate}
              disableRun={currentSelectedCompetitors().length < 2}
              onRunSimulation={runSimulation}
            />

            <Show
              when={
                compSettingsStore.competitorsByEvent()[compSettingsStore.selectedEventId()]
                  ?.length > 0
              }
              fallback={
                <div class="mt-6 text-center text-lg">No one is registered for this event</div>
              }
            >
              <ol
                class={cn(
                  "no-scrollbar mt-4 overflow-y-auto rounded-md border p-1",
                  windowWidth() > BREAKPOINT ? "max-h-[72vh]" : "max-h-[64vh]",
                )}
              >
                <For
                  each={compSettingsStore.competitorsByEvent()[compSettingsStore.selectedEventId()]}
                >
                  {(person) => (
                    <li class="rounded-md transition-colors hover:bg-secondary">
                      <div
                        onClick={() => toggleCompetitor(person.id)}
                        class={cn(
                          "flex cursor-pointer items-center justify-between p-2",
                          !person.selected && "text-muted-foreground",
                        )}
                      >
                        <CompetitorLink
                          name={person.name}
                          id={person.id}
                          event={compSettingsStore.selectedEventId()}
                          iso2={person.country}
                          class={cn("flex items-center", !person.selected && "opacity-50")}
                        />

                        <Checkbox
                          checked={person.selected}
                          class="pointer-events-none"
                          id={`select-${person.id}`}
                          aria-label={`Select competitor ${person.name}`}
                        />
                      </div>
                    </li>
                  )}
                </For>
              </ol>
            </Show>
          </div>
        </Show>
      </Show>
    </div>
  );
}
