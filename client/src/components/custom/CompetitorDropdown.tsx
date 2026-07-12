import { Show, Index } from "solid-js";
import { CircleAlert } from "lucide-solid";
import {
  type CompetitorSimulationResult,
  type SupportedWCAEvent,
  eventAttempts,
} from "../../lib/types";
import { formatPercentage } from "../../lib/utils";
import { IndividualHistogram } from "../charts/IndividualHistogram";
import { ColoredCircle } from "./ColoredCircle";
import { CompetitorLink } from "./CompetitorLink";
import { FMCEntryField } from "./FMCEntryField";
import { RotatableChevron } from "./RotatableChevron";
import { TimeEntryField } from "./TimeEntryField";

interface CompetitorDropdownProps {
  result: CompetitorSimulationResult;
  color: string;
  event: SupportedWCAEvent;
  value: number[];
  onChange: (val: number[]) => void;
  isOpen: boolean;
  onToggle: () => void;
}

export function CompetitorDropdown(props: CompetitorDropdownProps) {
  const lowDataWarningThreshold = 12;

  const winPercentage = () => formatPercentage(props.result.win_chance * 100);
  const podiumPercentage = () => formatPercentage(props.result.pod_chance * 100);
  const expectedRank = () => props.result.expected_rank.toFixed(4);

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          props.onToggle();
        }}
        aria-label={`Details for ${props.result.id}`}
        class="flex w-full items-center justify-between rounded-md p-2 ps-1 text-left hover:bg-secondary focus:outline-none focus-visible:bg-secondary"
      >
        <div class="flex min-w-0 flex-[2] items-center gap-3 lg:flex-[1.5]">
          <ColoredCircle color={props.color} class="ms-2 shrink-0" />

          <CompetitorLink
            name={props.result.name}
            id={props.result.id}
            iso2={props.result.country_iso2}
            event={props.event}
          />

          <Show when={props.result.sample_size < lowDataWarningThreshold}>
            <span
              title={`Competitor only has performed ${props.result.sample_size} solves since date cutoff.`}
              class="cursor-help text-destructive"
              aria-label="Low result warning"
            >
              <CircleAlert class="h-4 w-4" />
            </span>
          </Show>
        </div>
        <div class="flex-1 text-center">{winPercentage()}</div>
        <div class="flex-1 text-center">{podiumPercentage()}</div>
        <div class="flex-1 text-center">{expectedRank()}</div>
        <RotatableChevron up={props.isOpen} />
      </button>

      <Show when={props.isOpen}>
        <div class="mt-1 space-y-4 rounded-md px-2 py-3 duration-200 animate-in fade-in-0">
          <IndividualHistogram
            color={props.color}
            data={props.result.histogram}
            event={props.event}
          />

          <div class="flex flex-wrap items-center gap-2 px-2 lg:ms-2 lg:gap-4">
            <Index each={Array.from({ length: eventAttempts[props.event] })}>
              {(_, idx) => {
                const attemptId = () => `attempt-${props.result.id}-${idx + 1}`;
                return (
                  <div class="flex items-center gap-2">
                    <label
                      for={attemptId()}
                      class="cursor-pointer text-xs whitespace-nowrap text-muted-foreground select-none"
                    >
                      Attempt {idx + 1}:
                    </label>
                    <div class="max-w-24">
                      <Show
                        when={props.event !== "333fm"}
                        fallback={
                          <FMCEntryField
                            id={attemptId()}
                            value={props.value[idx] ?? 0}
                            onChange={(val) => {
                              const updated = [...props.value];
                              updated[idx] = val;
                              props.onChange(updated);
                            }}
                          />
                        }
                      >
                        <TimeEntryField
                          id={attemptId()}
                          value={props.value[idx] ?? 0}
                          onChange={(val) => {
                            const updated = [...props.value];
                            updated[idx] = val;
                            props.onChange(updated);
                          }}
                        />
                      </Show>
                    </div>
                  </div>
                );
              }}
            </Index>
          </div>
        </div>
      </Show>
    </div>
  );
}
