<script setup lang="ts">
import FullHistogram from "@/components/charts/FullHistogram.vue";
import HistoryHistogram from "@/components/charts/HistoryHistogram.vue";
import RankHistogram from "@/components/charts/RankHistogram.vue";
import CompetitorList from "@/components/custom/CompetitorList.vue";
import ErrorDisplay from "@/components/custom/ErrorPanel.vue";
import ExpandableBox from "@/components/custom/ExpandableBox.vue";
import LoadingMessage from "@/components/custom/LoadingMessage.vue";
import ResultsSummary from "@/components/custom/ResultsSummary.vue";
import { Button } from "@/components/ui/button";
import { useSimulation } from "@/lib/composables/useSimulation";
import {
  eventAttempts,
  eventNames,
  SimulationRouteQuery,
  SupportedWCAEvent,
} from "@/lib/types";
import {
  createCSVExport,
  createJSONExport,
  downloadTextBlob,
  generateColors,
  getParentPath,
} from "@/lib/utils";
import { LoaderCircle } from "lucide-vue-next";
import { computed, onMounted } from "vue";
import { RouteParams, useRoute, useRouter } from "vue-router";

const router = useRouter();
const currentVueRoute = useRoute();
const path = currentVueRoute.path;

const queryParams = currentVueRoute.query as SimulationRouteQuery & RouteParams;

const {
  competitors: competitorsParam,
  eventId: eventIdParam,
  name: nameParam,
  startDate: startDateParam,
  endDate: endDateParam,
  includeDnf: includeDnfParam,
  decayRate: decayRateParam,
  competitionId: competitionIdParam,
  date: competitionDateParam,
} = queryParams;

if (
  !competitorsParam ||
  !eventIdParam ||
  !nameParam ||
  !startDateParam ||
  !includeDnfParam ||
  !decayRateParam ||
  !(eventIdParam in eventNames)
) {
  router.push(getParentPath(path));
}

const name = nameParam!;
const startDate = new Date(startDateParam!);
const endDate = endDateParam ? new Date(endDateParam) : new Date();
const decayHalfLife = parseInt(decayRateParam!);
const competitorsList = competitorsParam!.split(",");
const includeDNF = includeDnfParam === "true";
const event = eventIdParam! as SupportedWCAEvent;
const colors = generateColors(competitorsList.length);
const attemptsCount = eventAttempts[event];

const {
  error,
  simulationResults,
  recalculateLoading,
  wcaLiveLoading,
  inputtedTimes,
  inputtedTimesState,
  runInitialSimulation,
  handleRecalculation,
  reset,
  syncResultsWithWCALive: syncResultsWithWCALiveBase,
} = useSimulation({
  event,
  competitorsList,
  decayHalfLife,
  includeDNF,
  startDate,
  endDate,
  attemptsCount,
});

const sharedProps = computed(() => ({
  data: simulationResults.value!,
  colors,
  event,
}));

const historyCompetitors = computed(
  () =>
    simulationResults.value?.competitor_results.map((c, index) => ({
      id: c.id,
      color: colors[index],
    })) ?? [],
);

const historyDataParams = computed(() => ({
  event_id: event,
  start_date: startDate.toISOString().split("T")[0],
  end_date: endDate.toISOString().split("T")[0],
  half_life: decayHalfLife,
  include_dnf: includeDNF,
}));

onMounted(() => {
  runInitialSimulation();
});

const syncResultsWithWCALive = async () => {
  if (!showWCALiveImport()) {
    return;
  }

  if (competitionIdParam) {
    await syncResultsWithWCALiveBase(competitionIdParam);
  }
};

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

const exportJson = () => {
  const jsonText = createJSONExport({
    competitionName: name,
    results: simulationResults.value!,
    ids: competitorsList,
    currentTimes: inputtedTimes.value,
    startDate,
    endDate,
    decayRate: decayHalfLife,
    includeDnf: includeDNF,
    event,
  });

  downloadTextBlob(jsonText, `${name}_results.json`, "application/json");
};

const exportCSV = () => {
  const csvText = createCSVExport(
    simulationResults.value!,
    competitorsList,
    inputtedTimes.value,
  );
  downloadTextBlob(csvText, `${name}_results.csv`, "text/csv");
};
</script>

<template>
  <div class="content-main mx-2 flex flex-col items-center justify-center">
    <h1 class="mt-4 mb-4 text-center text-2xl font-bold">
      Results for {{ name }}
    </h1>

    <div v-if="!!error">
      <ErrorDisplay :error />
    </div>

    <div
      v-else-if="simulationResults"
      class="border-lg md:min-w-full lg:min-w-250"
    >
      <ResultsSummary
        :data="simulationResults"
        :colors="colors"
        :event="event"
      />

      <ExpandableBox title="Results Histogram" class="mb-2">
        <FullHistogram v-bind="sharedProps" />
      </ExpandableBox>

      <ExpandableBox title="Predicted Ranks" class="mb-2">
        <RankHistogram :data="simulationResults.rank_histogram" :colors />
      </ExpandableBox>

      <ExpandableBox title="History">
        <HistoryHistogram
          :competitors="historyCompetitors"
          :data="historyDataParams"
        />
      </ExpandableBox>

      <CompetitorList
        :simulation-results="simulationResults.competitor_results"
        :colors
        :event
        v-model="inputtedTimes"
      />

      <p class="text-muted-foreground m-2">
        Export as:
        <button
          class="me-1 underline hover:text-gray-300"
          @click="exportJson()"
        >
          json
        </button>
        <button class="underline hover:text-gray-300" @click="exportCSV()">
          csv
        </button>
      </p>

      <div class="fixed right-2 bottom-4 z-50 flex">
        <Transition name="fade">
          <Button
            @click="syncResultsWithWCALive"
            class="me-2"
            v-if="showWCALiveImport()"
            :disabled="wcaLiveLoading || recalculateLoading"
          >
            Import Current Results From WCA Live
            <LoaderCircle v-show="wcaLiveLoading" class="animate-spin" />
          </Button>
        </Transition>
        <Transition name="fade">
          <Button
            @click="handleRecalculation"
            class="me-2"
            :disabled="recalculateLoading || !inputtedTimesState.isModified"
            v-if="inputtedTimesState.isModified"
          >
            {{ recalculateLoading ? "Recalculating..." : "Recalculate" }}
            <LoaderCircle v-show="recalculateLoading" class="animate-spin" />
          </Button>
        </Transition>
        <Transition name="fade">
          <Button
            @click="reset"
            v-if="inputtedTimesState.hasNonZero"
            :disabled="recalculateLoading"
          >
            Reset
          </Button>
        </Transition>
      </div>
    </div>

    <div v-else class="mt-4">
      <LoadingMessage message="Calculating" />
    </div>
  </div>
</template>
