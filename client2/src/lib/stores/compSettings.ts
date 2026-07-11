import { createSignal } from "solid-js";
import type { Competitor, SupportedWCAEvent } from "../types";

// Default values
const defaultValues = {
  competitorsByEvent: () => ({}) as Record<string, Competitor[]>,
  decayHalfLife: () => 180,
  endDate: () => new Date(),
  includeDnf: () => true,
  selectedEventId: () => "333" as SupportedWCAEvent,
  startDate: () => new Date(new Date().setFullYear(new Date().getFullYear() - 1)),
};

// Global Store State using SolidJS Signals
const [compId, setCompId] = createSignal<string | undefined>();
const [competitorsByEvent, setCompetitorsByEvent] = createSignal<Record<string, Competitor[]>>(
  defaultValues.competitorsByEvent(),
);
const [selectedEventId, setSelectedEventId] = createSignal<SupportedWCAEvent>(
  defaultValues.selectedEventId(),
);
const [includeDnf, setIncludeDnf] = createSignal<boolean>(defaultValues.includeDnf());
const [decayHalfLife, setDecayHalfLife] = createSignal<number>(defaultValues.decayHalfLife());
const [startDate, setStartDate] = createSignal<Date | undefined>(defaultValues.startDate());
const [endDate, setEndDate] = createSignal<Date | undefined>(defaultValues.endDate());

export const compSettingsStore = {
  compId,
  competitorsByEvent,
  decayHalfLife,
  endDate,
  includeDnf,
  reset() {
    setCompetitorsByEvent(defaultValues.competitorsByEvent());
    setSelectedEventId(defaultValues.selectedEventId());
    setIncludeDnf(defaultValues.includeDnf());
    setDecayHalfLife(defaultValues.decayHalfLife());
    setStartDate(defaultValues.startDate());
    setEndDate(defaultValues.endDate());
  },
  selectedEventId,
  setCompId,
  setCompetitorsByEvent,
  setDecayHalfLife,
  setEndDate,
  setIncludeDnf,
  setSelectedEventId,
  setStartDate,
  startDate,
};
