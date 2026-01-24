<script setup lang="ts">
import FullHistogram from "@/components/charts/FullHistogram.vue";
import RankHistogram from "@/components/charts/RankHistogram.vue";
import CompetitorList from "@/components/custom/CompetitorList.vue";
import ErrorDisplay from "@/components/custom/ErrorPanel.vue";
import ExpandableBox from "@/components/custom/ExpandableBox.vue";
import LoadingMessage from "@/components/custom/LoadingMessage.vue";
import ResultsSummary from "@/components/custom/ResultsSummary.vue";
import { Button } from "@/components/ui/button";
import {
  eventAttempts,
  eventNames,
  SimulationAPIResultItem,
  SimulationResult,
  SimulationRouteQuery,
  SupportedWCAEvent,
} from "@/lib/types";
import {
  ArrEq2D,
  clone2DArr,
  createCSVExport,
  createJSONExport,
  downloadTextBlob,
  formatInputtedTimes,
  generateColors,
  generateDefaultTimesArray,
  getParentPath,
} from "@/lib/utils";
import fetchWCALiveResults from "@/lib/wcaLive";
import { LoaderCircle } from "lucide-vue-next";
import { computed, onMounted, ref } from "vue";
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
const numSimulations = 100_000; // Hardcoded at 100,000
const startDate = new Date(startDateParam!);
const endDate = endDateParam ? new Date(endDateParam) : new Date();
const decayHalfLife = parseInt(decayRateParam!);
const competitorsList = competitorsParam!.split(",");
const includeDNF = includeDnfParam === "true";
const event = eventIdParam! as SupportedWCAEvent;
const colors = generateColors(competitorsList.length);

const attemptsCount = eventAttempts[event];
const defaultTimesArray = generateDefaultTimesArray(
  competitorsList.length,
  attemptsCount,
);

const error = ref<string>("");
const simulationResults = ref<SimulationResult[] | null>(null);
const loading = ref<boolean>(true);
const recalculateLoading = ref<boolean>(false);
const wcaLiveLoading = ref<boolean>(false);
const inputtedTimes = ref<number[][]>(clone2DArr(defaultTimesArray));
const inputtedTimesPrev = ref<number[][]>(clone2DArr(defaultTimesArray));

const inputtedTimesState = computed(() => {
  const hasNonZero = inputtedTimes.value.some((competitor: number[]) =>
    competitor.some((time) => time !== 0),
  );
  const isModified = !ArrEq2D(inputtedTimes.value, inputtedTimesPrev.value);

  return { hasNonZero, isModified };
});

const sharedProps = computed(() => ({
  data: simulationResults.value ?? [],
  colors,
  numSimulations,
  event,
}));

// --- API Service Function ---
const fetchSimulationResults = async () => {
  const formatDate = (d: Date) => d.toISOString().split("T")[0];

  const payload = {
    competitor_ids: competitorsList,
    event_id: event,
    start_date: formatDate(startDate),
    end_date: formatDate(endDate),
    half_life: decayHalfLife,
    entered_times: formatInputtedTimes(inputtedTimes.value, event),
    include_dnf: includeDNF,
  };

  const response = await fetch("http://localhost:3000/api/simulation", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Simulation failed: ${response.statusText} - ${errorText}`);
  }

  const rawData = await response.json();

  return rawData.map((item: SimulationAPIResultItem) => ({
    ...item,
    hist_values_single: new Map(
      Object.entries(item.hist_values_single || {}).map(([k, v]) => [
        Number(k),
        Number(v),
      ]),
    ),
    hist_values_average: new Map(
      Object.entries(item.hist_values_average || {}).map(([k, v]) => [
        Number(k),
        Number(v),
      ]),
    ),
  })) as SimulationResult[];
};

const runInitialSimulation = async () => {
  try {
    const results = await fetchSimulationResults();

    if (results) {
      simulationResults.value = results;
      inputtedTimesPrev.value = clone2DArr(inputtedTimes.value);
    }
  } catch (err) {
    console.error("Error in initial simulation:", err);
    error.value =
      err instanceof Error
        ? err.message
        : "Unknown error occurred during initial simulation";
  }
};

const handleRecalculation = async () => {
  try {
    const results = await fetchSimulationResults();

    if (results) {
      simulationResults.value = results;
      inputtedTimesPrev.value = clone2DArr(inputtedTimes.value);
    }
  } catch (err) {
    console.error("Error in recalculation:", err);
    error.value =
      err instanceof Error
        ? err.message
        : "Unknown error occurred during recalculation";
  }
};

onMounted(async () => {
  loading.value = true;
  await runInitialSimulation();
  loading.value = false;
});

const recalculate = async () => {
  recalculateLoading.value = true;
  error.value = "";
  await handleRecalculation();
  recalculateLoading.value = false;
};

const reset = async () => {
  inputtedTimes.value = clone2DArr(defaultTimesArray);
  await recalculate();
};

const syncResultsWithWCALive = async () => {
  if (!showWCALiveImport()) {
    return;
  }

  wcaLiveLoading.value = true;
  try {
    const results = await fetchWCALiveResults(
      competitionIdParam!,
      event,
      competitorsList,
    );

    inputtedTimes.value = results;
    await recalculate();
  } catch (err) {
    console.error(err);
  } finally {
    wcaLiveLoading.value = false;
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
    simCount: numSimulations,
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
    numSimulations,
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
        :data="simulationResults || []"
        :colors="colors"
        :numSimulations="numSimulations"
        :event="event"
      />

      <ExpandableBox title="Results Histogram" class="mb-2">
        <FullHistogram v-bind="sharedProps" />
      </ExpandableBox>

      <ExpandableBox title="Predicted Ranks">
        <RankHistogram v-bind="sharedProps" />
      </ExpandableBox>
      <CompetitorList
        :simulation-results="simulationResults"
        :colors
        :num-simulations="numSimulations"
        :event
        v-model="inputtedTimes"
      />

      <p class="text-muted-foreground m-2">
        Export as:
        <a
          role="button"
          class="me-1 underline hover:text-gray-300"
          @click="exportJson()"
          >json</a
        >
        <a
          role="button"
          class="underline hover:text-gray-300"
          @click="exportCSV()"
          >csv</a
        >
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
            @click="recalculate"
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
