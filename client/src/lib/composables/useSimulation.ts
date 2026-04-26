import type { SimulationAPIResults, SupportedWCAEvent } from "@/lib/types";
import {
  API_URL,
  ArrEq2D,
  clone2DArr,
  formatInputtedTimes,
  generateDefaultTimesArray,
} from "@/lib/utils";
import fetchWCALiveResults from "@/lib/wcaLive";
import { computed, ref } from "vue";

export function useSimulation({
  event,
  competitorsList,
  decayHalfLife,
  includeDNF,
  startDate,
  endDate,
  attemptsCount,
}: {
  event: SupportedWCAEvent;
  competitorsList: string[];
  decayHalfLife: number;
  includeDNF: boolean;
  startDate: Date;
  endDate: Date;
  attemptsCount: number;
}) {
  const defaultTimesArray = generateDefaultTimesArray(
    competitorsList.length,
    attemptsCount,
  );

  const error = ref<string>("");
  const simulationResults = ref<SimulationAPIResults | null>(null);
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

    const response = await fetch(`${API_URL}/api/simulation`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Simulation failed: ${response.statusText} - ${errorText}`,
      );
    }

    const rawData = await response.json();
    return rawData as SimulationAPIResults;
  };

  const runInitialSimulation = async () => {
    loading.value = true;
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
    } finally {
      loading.value = false;
    }
  };

  const handleRecalculation = async () => {
    recalculateLoading.value = true;
    error.value = "";
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
    } finally {
      recalculateLoading.value = false;
    }
  };

  const reset = async () => {
    inputtedTimes.value = clone2DArr(defaultTimesArray);
    await handleRecalculation();
  };

  const syncResultsWithWCALive = async (competitionId: string) => {
    wcaLiveLoading.value = true;
    try {
      const results = await fetchWCALiveResults(
        competitionId,
        event,
        competitorsList,
      );

      inputtedTimes.value = results;
      await handleRecalculation();
    } catch (err) {
      console.error(err);
    } finally {
      wcaLiveLoading.value = false;
    }
  };

  return {
    error,
    simulationResults,
    loading,
    recalculateLoading,
    wcaLiveLoading,
    inputtedTimes,
    inputtedTimesPrev,
    inputtedTimesState,
    runInitialSimulation,
    handleRecalculation,
    reset,
    syncResultsWithWCALive,
  };
}
