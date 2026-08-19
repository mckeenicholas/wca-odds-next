import type { Competitor, SupportedWCAEvent } from "../types";
import { createStore } from "solid-js/store";

interface CompSettingsState {
  compId: string | undefined;
  competitorsByEvent: Record<string, Competitor[]>;
  selectedEventId: SupportedWCAEvent;
  includeDnf: boolean;
  decayHalfLife: number;
  startDate: Date | undefined;
  endDate: Date | undefined;
}

// Default values
const defaultValues = {
  competitorsByEvent: () => ({}) as Record<string, Competitor[]>,
  decayHalfLife: () => 180,
  endDate: () => new Date(),
  includeDnf: () => true,
  selectedEventId: () => "333" as SupportedWCAEvent,
  startDate: () => new Date(new Date().setFullYear(new Date().getFullYear() - 1)),
};

// Global Store State using SolidJS createStore
const [state, setState] = createStore<CompSettingsState>({
  compId: undefined,
  competitorsByEvent: defaultValues.competitorsByEvent(),
  selectedEventId: defaultValues.selectedEventId(),
  includeDnf: defaultValues.includeDnf(),
  decayHalfLife: defaultValues.decayHalfLife(),
  startDate: defaultValues.startDate(),
  endDate: defaultValues.endDate(),
});

export const compSettingsStore = {
  // Read-only getters maintaining function compatibility
  compId: () => state.compId,
  competitorsByEvent: () => state.competitorsByEvent,
  decayHalfLife: () => state.decayHalfLife,
  endDate: () => state.endDate,
  includeDnf: () => state.includeDnf,
  selectedEventId: () => state.selectedEventId,
  startDate: () => state.startDate,

  // Setters
  setCompId: (val: string | undefined) => {
    setState("compId", val);
  },
  setCompetitorsByEvent: (val: Record<string, Competitor[]>) => {
    setState("competitorsByEvent", val);
  },
  setDecayHalfLife: (val: number) => {
    setState("decayHalfLife", val);
  },
  setEndDate: (val: Date | undefined) => {
    setState("endDate", val);
  },
  setIncludeDnf: (val: boolean) => {
    setState("includeDnf", val);
  },
  setSelectedEventId: (val: SupportedWCAEvent) => {
    setState("selectedEventId", val);
  },
  setStartDate: (val: Date | undefined) => {
    setState("startDate", val);
  },

  reset: () => {
    setState({
      compId: undefined,
      competitorsByEvent: defaultValues.competitorsByEvent(),
      selectedEventId: defaultValues.selectedEventId(),
      includeDnf: defaultValues.includeDnf(),
      decayHalfLife: defaultValues.decayHalfLife(),
      startDate: defaultValues.startDate(),
      endDate: defaultValues.endDate(),
    });
  },
};
