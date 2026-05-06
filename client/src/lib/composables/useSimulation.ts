import { type Ref, computed, ref } from "vue";
import type { SimulationAPIResults, SupportedWCAEvent } from "@/lib/types";
import {
  API_URL,
  arrEq2D,
  clone2DArr,
  formatInputtedTimes,
  generateDefaultTimesArray,
} from "@/lib/utils";
import fetchWCALiveResults from "@/lib/wcaLive";

const formatDate = (d: Date) => d.toISOString().split("T")[0];

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

  const errorMessage = ref<string>("");
  const simulationResults = ref<SimulationAPIResults | undefined>(undefined);
  const loading = ref<boolean>(true);
  const recalculateLoading = ref<boolean>(false);
  const wcaLiveLoading = ref<boolean>(false);
  const inputtedTimes = ref<number[][]>(clone2DArr(defaultTimesArray));
  const inputtedTimesPrev = ref<number[][]>(clone2DArr(defaultTimesArray));

  const inputtedTimesState = computed(() => {
    const hasNonZero = inputtedTimes.value.some((competitor: number[]) =>
      competitor.some((time) => time !== 0),
    );
    const isModified = !arrEq2D(inputtedTimes.value, inputtedTimesPrev.value);

    return { hasNonZero, isModified };
  });

  const fetchSimulationResults = async () => {
    const payload = {
      competitor_ids: competitorsList,
      end_date: formatDate(endDate),
      entered_times: formatInputtedTimes(inputtedTimes.value, event),
      event_id: event,
      half_life: decayHalfLife,
      include_dnf: includeDNF,
      start_date: formatDate(startDate),
    };

    const response = await fetch(`${API_URL}/api/simulation`, {
      body: JSON.stringify(payload),
      headers: { "Content-Type": "application/json" },
      method: "POST",
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

  const runSimulation = async (loadingRef: Ref<boolean>) => {
    loadingRef.value = true;
    errorMessage.value = "";
    try {
      const results = await fetchSimulationResults();
      if (results) {
        simulationResults.value = results;
        inputtedTimesPrev.value = clone2DArr(inputtedTimes.value);
      }
    } catch (error) {
      console.error("Simulation error:", error);
      errorMessage.value =
        error instanceof Error ? error.message : "Unknown error occurred";
    } finally {
      loadingRef.value = false;
    }
  };

  const runInitialSimulation = () => runSimulation(loading);

  const handleRecalculation = () => runSimulation(recalculateLoading);

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
    } catch (error) {
      console.error(error);
    } finally {
      wcaLiveLoading.value = false;
    }
  };

  return {
    error: errorMessage,
    handleRecalculation,
    inputtedTimes,
    inputtedTimesPrev,
    inputtedTimesState,
    loading,
    recalculateLoading,
    reset,
    runInitialSimulation,
    simulationResults,
    syncResultsWithWCALive,
    wcaLiveLoading,
  };
}
