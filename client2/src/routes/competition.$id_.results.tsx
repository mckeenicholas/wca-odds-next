import { createEffect, createMemo, onMount, Show, Suspense } from "solid-js";
import { createFileRoute, useNavigate } from "@tanstack/solid-router";
import { LoaderCircle } from "lucide-solid";
import { z } from "zod";
import { FullHistogram } from "../components/charts/FullHistogram";
import { HistoryHistogram } from "../components/charts/HistoryHistogram";
import { RankHistogram } from "../components/charts/RankHistogram";
import { CompetitorList } from "../components/custom/CompetitorList";
import { ErrorPanel } from "../components/custom/ErrorPanel";
import { ExpandableBox } from "../components/custom/ExpandableBox";
import { LoadingMessage } from "../components/custom/LoadingMessage";
import { ResultsSummary } from "../components/custom/ResultsSummary";
import { Button } from "../components/ui/button";
import { eventAttempts, eventNames, type SupportedWCAEvent } from "../lib/types";
import { useSimulation } from "../lib/useSimulation";
import {
  createCSVExport,
  createJSONExport,
  downloadTextBlob,
  generateColors,
  getParentPath,
  toInt,
} from "../lib/utils";

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
  const searchParams = Route.useSearch()();
  const navigate = useNavigate();

  const competitorsParam = searchParams.competitors;
  const eventIdParam = searchParams.eventId;
  const nameParam = searchParams.name;
  const startDateParam = searchParams.startDate;
  const endDateParam = searchParams.endDate;
  const includeDnfParam = searchParams.includeDnf;
  const decayRateParam = searchParams.decayRate;
  const competitionIdParam = searchParams.competitionId;
  const competitionDateParam = searchParams.date;

  createEffect(() => {
    if (
      !competitorsParam ||
      !eventIdParam ||
      !nameParam ||
      !startDateParam ||
      !includeDnfParam ||
      !decayRateParam ||
      !(eventIdParam in eventNames)
    ) {
      const parent = getParentPath(globalThis.location.pathname);
      void navigate({ to: parent, replace: true });
    }
  });

  const name = nameParam ?? "";
  const startDate = new Date(startDateParam ?? new Date());
  const endDate = endDateParam ? new Date(endDateParam) : new Date();
  const decayHalfLife = toInt(decayRateParam, 180);
  const competitorsList = (competitorsParam ?? "").split(",").filter(Boolean);
  const includeDNF = includeDnfParam === "true";
  const event = eventIdParam as SupportedWCAEvent;
  const colors = generateColors(competitorsList.length);
  const attemptsCount = eventAttempts[event] ?? 5;

  const sim = useSimulation({
    event,
    competitorsList,
    decayHalfLife,
    includeDNF,
    startDate,
    endDate,
    attemptsCount,
  });

  const historyCompetitors = createMemo(
    () =>
      sim.simulationResults()?.competitor_results.map((c, index) => ({
        color: colors[index],
        id: c.id,
      })) ?? [],
  );

  const historyDataParams = createMemo(() => ({
    event_id: event,
    start_date: startDate.toISOString().split("T")[0],
    end_date: endDate.toISOString().split("T")[0],
    half_life: decayHalfLife,
    include_dnf: includeDNF,
  }));

  onMount(() => {
    void sim.runInitialSimulation();
  });

  const showWCALiveImport = () => {
    if (!competitionIdParam || !competitionDateParam) {
      return false;
    }

    const today = new Date();
    const competitionDate = new Date(competitionDateParam);

    if (competitionDate > today) {
      return false;
    }

    const removalCutoff = new Date();
    removalCutoff.setDate(today.getDate() - 90);

    return competitionDate > removalCutoff;
  };

  const syncResultsWithWCALive = async () => {
    if (!showWCALiveImport()) {
      return;
    }

    if (competitionIdParam) {
      await sim.syncResultsWithWCALive(competitionIdParam);
    }
  };

  const exportJson = () => {
    const jsonText = createJSONExport({
      competitionName: name,
      results: sim.simulationResults()!,
      ids: competitorsList,
      currentTimes: sim.inputtedTimes(),
      startDate,
      endDate,
      decayRate: decayHalfLife,
      includeDnf: includeDNF,
      event,
    });

    downloadTextBlob(jsonText, `${name}_results.json`, "application/json");
  };

  const exportCSV = () => {
    const csvText = createCSVExport(sim.simulationResults()!, competitorsList, sim.inputtedTimes());
    downloadTextBlob(csvText, `${name}_results.csv`, "text/csv");
  };

  return (
    <div class="mx-2 flex flex-col items-center justify-center p-4">
      <h1 class="mt-4 mb-4 text-center text-2xl font-bold">Results for {name}</h1>

      <Show when={!sim.error()} fallback={<ErrorPanel error={sim.error()} />}>
        <Show
          when={!sim.loading() && sim.simulationResults()}
          fallback={<LoadingMessage message="Calculating Simulation" class="text-2xl" />}
        >
          <div class="border-lg w-full max-w-5xl space-y-4">
            <ResultsSummary data={sim.simulationResults()!} colors={colors} event={event} />

            <ExpandableBox title="Results Histogram" class="mb-2">
              <FullHistogram data={sim.simulationResults()!} colors={colors} event={event} />
            </ExpandableBox>

            <ExpandableBox title="Predicted Ranks" class="mb-2">
              <RankHistogram data={sim.simulationResults()!.rank_histogram} colors={colors} />
            </ExpandableBox>

            <ExpandableBox title="History" class="mb-2">
              <Suspense
                fallback={
                  <div class="flex min-h-75 items-center justify-center">
                    <LoaderCircle class="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                }
              >
                <HistoryHistogram competitors={historyCompetitors()} data={historyDataParams()} />
              </Suspense>
            </ExpandableBox>

            <CompetitorList
              simulationResults={sim.simulationResults()!.competitor_results}
              colors={colors}
              event={event}
              value={sim.inputtedTimes()}
              onChange={sim.setInputtedTimes}
            />

            <p class="m-2 mb-6 text-sm text-muted-foreground">
              Export as:{" "}
              <button
                class="me-1 cursor-pointer underline hover:text-foreground"
                onClick={exportJson}
              >
                json
              </button>
              {" / "}
              <button class="cursor-pointer underline hover:text-foreground" onClick={exportCSV}>
                csv
              </button>
            </p>
          </div>
        </Show>
      </Show>

      {/* Floating recalculation/reset controls */}
      <div class="fixed right-2 bottom-4 z-50 flex gap-2">
        <Show when={showWCALiveImport()}>
          <Button
            onClick={syncResultsWithWCALive}
            disabled={sim.wcaLiveLoading() || sim.recalculateLoading()}
          >
            Import Current Results From WCA Live
            <Show when={sim.wcaLiveLoading()}>
              <LoaderCircle class="ml-2 h-4 w-4 animate-spin" />
            </Show>
          </Button>
        </Show>

        <Show when={sim.isModified()}>
          <Button onClick={sim.handleRecalculation} disabled={sim.recalculateLoading()}>
            {sim.recalculateLoading() ? "Recalculating..." : "Recalculate"}
            <Show when={sim.recalculateLoading()}>
              <LoaderCircle class="ml-2 h-4 w-4 animate-spin" />
            </Show>
          </Button>
        </Show>

        <Show when={sim.hasNonZero()}>
          <Button onClick={sim.reset} disabled={sim.recalculateLoading()} variant="outline">
            Reset
          </Button>
        </Show>
      </div>
    </div>
  );
}
