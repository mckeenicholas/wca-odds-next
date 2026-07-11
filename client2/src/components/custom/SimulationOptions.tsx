import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Switch } from "../ui/switch";
import { DateRangePicker } from "./DateRangePicker";

interface SimulationOptionsProps {
  includeDnf: boolean;
  onIncludeDnfChange: (val: boolean) => void;
  decayRate: number;
  onDecayRateChange: (val: number) => void;
  startDate: Date | undefined;
  onStartDateChange: (date: Date | undefined) => void;
  endDate: Date | undefined;
  onEndDateChange: (date: Date | undefined) => void;
}

export function SimulationOptions(props: SimulationOptionsProps) {
  return (
    <>
      <div class="flex items-center min-[1255px]:border-r min-[1255px]:pe-4">
        <Label class="me-2 shrink-0">Use results from:</Label>
        <DateRangePicker
          startDate={props.startDate}
          onStartDateChange={props.onStartDateChange}
          endDate={props.endDate}
          onEndDateChange={props.onEndDateChange}
          allowFuture={false}
        />
      </div>
      <div class="flex items-center min-[1255px]:border-r min-[1255px]:pe-4">
        <Label class="shrink-0" for="decayRate">
          Result decay half-life
        </Label>
        <Input
          type="number"
          id="decayRate"
          class="mx-2 h-9 max-w-16 px-2 text-center"
          value={props.decayRate}
          onInput={(val: string) => props.onDecayRateChange(Number(val) || 0)}
        />
        <Label class="shrink-0" for="decayRate">
          days
        </Label>
      </div>
      <div class="flex items-center gap-2">
        <Label class="me-2 shrink-0">Include DNFs</Label>
        <Switch checked={props.includeDnf} onChange={props.onIncludeDnfChange} />
      </div>
    </>
  );
}
