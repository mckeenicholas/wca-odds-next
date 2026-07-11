import { createSignal, onCleanup, onMount } from "solid-js";
import { Button } from "../ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "../ui/select";
import { eventNames, type SupportedWCAEvent } from "../../lib/types";
import { CubingIcon } from "./CubingIcon";
import { ExpandableBox } from "./ExpandableBox";
import { SimulationOptions } from "./SimulationOptions";

interface ControlPanelProps {
  eventIds: SupportedWCAEvent[];
  selectedEventId: SupportedWCAEvent;
  onSelectedEventIdChange: (val: SupportedWCAEvent) => void;
  includeDnf: boolean;
  onIncludeDnfChange: (val: boolean) => void;
  decayRate: number;
  onDecayRateChange: (val: number) => void;
  startDate: Date | undefined;
  onStartDateChange: (date: Date | undefined) => void;
  endDate: Date | undefined;
  onEndDateChange: (date: Date | undefined) => void;
  disableRun?: boolean;
  onRunSimulation: () => void;
}

export function ControlPanel(props: ControlPanelProps) {
  const [windowWidth, setWindowWidth] = createSignal(
    typeof window !== "undefined" ? window.innerWidth : 1200,
  );

  onMount(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    onCleanup(() => window.removeEventListener("resize", handleResize));
  });

  const BREAKPOINT = 768;
  const hasCompleteDateRange = () => !!props.startDate && !!props.endDate;

  return (
    <>
      <Select
        options={props.eventIds}
        value={props.selectedEventId}
        onChange={(val) => {
          if (val) {
            props.onSelectedEventIdChange(val);
          }
        }}
        itemComponent={(itemProps) => (
          <SelectItem item={itemProps.item}>
            <CubingIcon event={itemProps.item.rawValue} class="me-1" showTooltip={false} />
            {eventNames[itemProps.item.rawValue]}
          </SelectItem>
        )}
      >
        <SelectTrigger class="ms-0 min-h-10.5 font-normal" aria-label="Event select dropdown">
          <div class="flex items-center">
            <CubingIcon event={props.selectedEventId} class="me-1" showTooltip={false} />
            <SelectValue>
              {(state) => eventNames[state.selectedOption() as SupportedWCAEvent]}
            </SelectValue>
          </div>
        </SelectTrigger>
        <SelectContent />
      </Select>

      {windowWidth() >= BREAKPOINT ? (
        <div class="my-2 flex items-center space-x-4 rounded-md border p-2">
          <SimulationOptions
            includeDnf={props.includeDnf}
            onIncludeDnfChange={props.onIncludeDnfChange}
            decayRate={props.decayRate}
            onDecayRateChange={props.onDecayRateChange}
            startDate={props.startDate}
            onStartDateChange={props.onStartDateChange}
            endDate={props.endDate}
            onEndDateChange={props.onEndDateChange}
          />
          <div class="flex grow justify-end">
            <Button
              onClick={props.onRunSimulation}
              disabled={props.disableRun || !hasCompleteDateRange()}
            >
              Run Simulation
            </Button>
          </div>
        </div>
      ) : (
        <>
          <ExpandableBox title="Options" class="my-2">
            <hr class="mx-2" />
            <div class="flex flex-col items-stretch space-y-4 p-4">
              <SimulationOptions
                includeDnf={props.includeDnf}
                onIncludeDnfChange={props.onIncludeDnfChange}
                decayRate={props.decayRate}
                onDecayRateChange={props.onDecayRateChange}
                startDate={props.startDate}
                onStartDateChange={props.onStartDateChange}
                endDate={props.endDate}
                onEndDateChange={props.onEndDateChange}
              />
            </div>
          </ExpandableBox>
          <div class="mb-2 flex flex-col">
            <Button
              onClick={props.onRunSimulation}
              disabled={props.disableRun || !hasCompleteDateRange()}
            >
              Run Simulation
            </Button>
          </div>
        </>
      )}
    </>
  );
}
