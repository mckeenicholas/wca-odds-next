import type { SimulationAPIResults, SupportedWCAEvent } from "./types";
import { createSignal } from "solid-js";
import {
  API_URL,
  arrEq2D,
  clone2DArr,
  formatInputtedTimes,
  generateDefaultTimesArray,
} from "./utils";
import fetchWCALiveResults from "./wcaLive";

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
  const defaultTimesArray = generateDefaultTimesArray(competitorsList.length, attemptsCount);

  const [simulationError, setSimulationError] = createSignal<string>("");
  const [simulationResults, setSimulationResults] = createSignal<
    SimulationAPIResults | undefined
  >();
  const [loading, setLoading] = createSignal<boolean>(true);
  const [recalculateLoading, setRecalculateLoading] = createSignal<boolean>(false);
  const [wcaLiveLoading, setWcaLiveLoading] = createSignal<boolean>(false);
  const [inputtedTimes, setInputtedTimes] = createSignal<number[][]>(clone2DArr(defaultTimesArray));
  const [inputtedTimesPrev, setInputtedTimesPrev] = createSignal<number[][]>(
    clone2DArr(defaultTimesArray),
  );

  const hasNonZero = () =>
    inputtedTimes().some((competitor: number[]) => competitor.some((time) => time !== 0));

  const isModified = () => !arrEq2D(inputtedTimes(), inputtedTimesPrev());

  const fetchSimulationResults = async () => {
    const payload = {
      competitor_ids: competitorsList,
      end_date: formatDate(endDate),
      entered_times: formatInputtedTimes(inputtedTimes(), event),
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
      throw new Error(`Simulation failed: ${response.statusText} - ${errorText}`);
    }

    const rawData = await response.json();
    return rawData as SimulationAPIResults;
  };

  const runSimulation = async (setLoadingState: (val: boolean) => void) => {
    setLoadingState(true);
    setSimulationError("");
    try {
      const results = await fetchSimulationResults();
      if (results) {
        setSimulationResults(results);
        setInputtedTimesPrev(clone2DArr(inputtedTimes()));
      }
    } catch (error) {
      console.error("Simulation error:", error);
      setSimulationError(error instanceof Error ? error.message : "Unknown error occurred");
    } finally {
      setLoadingState(false);
    }
  };

  const runInitialSimulation = () => runSimulation(setLoading);

  const handleRecalculation = () => runSimulation(setRecalculateLoading);

  const reset = async () => {
    setInputtedTimes(clone2DArr(defaultTimesArray));
    await handleRecalculation();
  };

  const syncResultsWithWCALive = async (competitionId: string) => {
    setWcaLiveLoading(true);
    try {
      const results = await fetchWCALiveResults(competitionId, event, competitorsList);

      setInputtedTimes(results);
      await handleRecalculation();
    } catch (error) {
      console.error(error);
    } finally {
      setWcaLiveLoading(false);
    }
  };

  return {
    error: simulationError,
    handleRecalculation,
    inputtedTimes,
    setInputtedTimes,
    inputtedTimesPrev,
    hasNonZero,
    isModified,
    loading,
    recalculateLoading,
    reset,
    runInitialSimulation,
    simulationResults,
    syncResultsWithWCALive,
    wcaLiveLoading,
  };
}
