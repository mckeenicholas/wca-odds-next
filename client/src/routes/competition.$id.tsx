import { createEffect, Index, Show } from "solid-js";
import { createQuery } from "@tanstack/solid-query";
import { createFileRoute, useNavigate } from "@tanstack/solid-router";
import { CompetitorLink } from "../components/custom/CompetitorLink";
import { ControlPanel } from "../components/custom/ControlPanel";
import { LoadingMessage } from "../components/custom/LoadingMessage";
import { WCALogo } from "../components/custom/WCALogo";
import { Checkbox } from "../components/ui/checkbox";
import { compSettingsStore } from "../lib/stores/compSettings";
import { supportedWCAEvents, type SupportedWCAEvent } from "../lib/types";
import { getCompetitorData } from "../lib/useCompetitionData";
import { fetchWCIF, buildSimulationQuery, cn } from "../lib/utils";

const currentSelectedCompetitors = () => {
  const list = compSettingsStore.competitorsByEvent()[compSettingsStore.selectedEventId()];
  return list?.filter((competitor) => competitor.selected) ?? [];
};

const toggleCompetitor = (competitorId: string) => {
  const currentEvent = compSettingsStore.selectedEventId();
  const currentList = compSettingsStore.competitorsByEvent()[currentEvent];
  if (!currentList) {
    return;
  }

  const newList = currentList.map((c) =>
    c.id === competitorId ? { ...c, selected: !c.selected } : c,
  );

  compSettingsStore.setCompetitorsByEvent({
    ...compSettingsStore.competitorsByEvent(),
    [currentEvent]: newList,
  });
};

export const Route = createFileRoute("/competition/$id")({
  component: CompetitionPage,
});

function CompetitionPage() {
  const params = Route.useParams();
  const navigate = useNavigate();

  const query = createQuery(() => ({
    queryFn: () => fetchWCIF(params().id),
    queryKey: ["competition", params().id],
    staleTime: Infinity,
  }));

  // Sync route params with store
  createEffect(() => {
    const { id } = params();
    if (id && id !== compSettingsStore.compId()) {
      compSettingsStore.reset();
      compSettingsStore.setCompId(id);
    }
  });

  const eventIds = () =>
    query.data?.events
      .map((event) => event.id)
      .filter(
        (id): id is SupportedWCAEvent =>
          id !== "333mbf" && supportedWCAEvents.includes(id as SupportedWCAEvent),
      ) ?? [];

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

  const runSimulation = () => {
    const d = query.data;
    if (!d) {
      return;
    }

    const selectedIds = currentSelectedCompetitors().map((item) => item.id);
    const startD = compSettingsStore.startDate();
    const endD = compSettingsStore.endDate();

    if (!startD || !endD) {
      return;
    }

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

    void navigate({
      search: queryParams,
      to: `/competition/${d.id}/results`,
    });
  };

  return (
    <div class="flex h-[calc(100vh-7rem)] w-full flex-col items-center p-4">
      <Show
        when={!query.isPending}
        fallback={<LoadingMessage message="Loading WCA Data" class="text-2xl" />}
      >
        <Show
          when={!query.isError && query.data?.name}
          fallback={
            <div class="text-red-500">
              Error fetching data: {query.error?.message ?? "Unknown error occurred"}
            </div>
          }
        >
          <h1 class="mb-4 flex shrink-0 items-center justify-center gap-2 text-center text-2xl leading-snug font-bold">
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
          <div class="flex min-h-0 w-full max-w-5xl grow flex-col">
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
              <ol class="no-scrollbar mt-4 min-h-0 flex-1 overflow-y-auto rounded-md border p-1">
                <Index
                  each={compSettingsStore.competitorsByEvent()[compSettingsStore.selectedEventId()]}
                >
                  {(person) => (
                    <li class="rounded-md transition-colors hover:bg-secondary">
                      <div
                        onClick={() => {
                          toggleCompetitor(person().id);
                        }}
                        class={cn(
                          "flex cursor-pointer items-center justify-between p-2",
                          !person().selected && "text-muted-foreground",
                        )}
                      >
                        <CompetitorLink
                          name={person().name}
                          id={person().id}
                          event={compSettingsStore.selectedEventId()}
                          iso2={person().country}
                          class={cn("flex items-center", !person().selected && "opacity-50")}
                        />

                        <Checkbox
                          checked={person().selected}
                          class="pointer-events-none"
                          id={`select-${person().id}`}
                          aria-label={`Select competitor ${person().name}`}
                        />
                      </div>
                    </li>
                  )}
                </Index>
              </ol>
            </Show>
          </div>
        </Show>
      </Show>
    </div>
  );
}
