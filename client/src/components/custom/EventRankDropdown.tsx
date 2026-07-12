import { createSignal, Show, Switch, Match } from "solid-js";
import { Collapsible } from "@kobalte/core/collapsible";
import { LoaderCircle } from "lucide-solid";
import { eventNames, type PersonRankInfo, type SupportedWCAEvent } from "../../lib/types";
import { useRankDetail } from "../../lib/useRankDetail";
import { cn, isTimeEvent, renderTime } from "../../lib/utils";
import { Button } from "../ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { CubingIcon } from "./CubingIcon";
import { DateRangePicker } from "./DateRangePicker";
import { RankingsAreaChart } from "./RankingsAreaChart";
import { RotatableChevron } from "./RotatableChevron";

interface EventRankDropdownProps {
  eventRank: PersonRankInfo;
  personId: string;
  personName: string;
  rankDate: Date;
  index: number;
}

export function EventRankDropdown(props: EventRankDropdownProps) {
  const [isOpen, setIsOpen] = createSignal(false);

  const {
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    applyDateRange,
    hasCompleteRange,
    metric,
    setMetric,
    query,
    mappedHistory,
  } = useRankDetail({
    competitorId: () => props.personId,
    competitorName: () => props.personName,
    eventId: () => props.eventRank.event_id,
    isOpen,
    rankDate: () => props.rankDate,
  });

  const eventLabel = () => {
    switch (props.eventRank.event_id) {
      case "all": {
        return "Sum of Ranks";
      }
      case "kinch": {
        return "Kinch";
      }
      case "kinch_strict": {
        return "Kinch Strict";
      }
      default: {
        return (
          eventNames[props.eventRank.event_id as SupportedWCAEvent] ?? props.eventRank.event_id
        );
      }
    }
  };

  const isFMC = () => props.eventRank.event_id === "333fm";

  const formatScore = (score: number) => {
    const eid = props.eventRank.event_id;
    if (eid === "all") {
      return score.toFixed(0);
    }
    if (["kinch", "kinch_strict"].includes(eid)) {
      return score.toFixed(2);
    }
    return renderTime(score, eid === "333fm");
  };

  const ariaId = () => `event-details-${props.personId}-${props.eventRank.event_id}`;

  return (
    <Collapsible open={isOpen()} onOpenChange={setIsOpen}>
      <Collapsible.Trigger
        aria-controls={ariaId()}
        class={cn(
          "flex w-full cursor-pointer justify-between rounded-md border-0 bg-transparent p-2 ps-1 text-left text-sm hover:bg-secondary focus:outline-none focus-visible:bg-secondary",
          props.index % 2 === 0 && "bg-muted/20",
        )}
      >
        <div class="flex w-16 shrink-0 items-center ps-3 text-left text-foreground md:w-28">
          {props.eventRank.rank}
        </div>
        <div class="flex flex-2 items-center text-left">
          <Show when={isTimeEvent(props.eventRank.event_id)}>
            <CubingIcon
              event={props.eventRank.event_id as SupportedWCAEvent}
              class="me-2"
              showTooltip={false}
            />
          </Show>
          {eventLabel()}
        </div>
        <div class="flex-1 pe-3 text-right">{formatScore(props.eventRank.value)}</div>
        <div class="flex w-6 shrink-0 items-center justify-end">
          <RotatableChevron up={isOpen()} />
        </div>
      </Collapsible.Trigger>

      <Collapsible.Content
        class="space-y-2 overflow-hidden duration-100 ease-out animate-in fade-in-0"
        id={ariaId()}
      >
        <Switch
          fallback={
            <div class="py-4 text-center text-sm text-muted-foreground">No history available.</div>
          }
        >
          <Match when={query.isPending}>
            <div class="flex justify-center py-4">
              <LoaderCircle class="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          </Match>

          <Match when={query.isError}>
            <div class="mt-2 py-4 text-center text-sm text-destructive">{query.error?.message}</div>
          </Match>

          <Match when={query.data && Array.isArray(query.data) && query.data.length > 0}>
            <div class="relative px-4 pt-2 pb-2">
              <Show when={query.isFetching}>
                <div class="absolute inset-0 z-10 flex items-center justify-center rounded-md bg-background/50">
                  <LoaderCircle class="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              </Show>
              <RankingsAreaChart
                history={mappedHistory()}
                metric={metric()}
                isTime={isTimeEvent(props.eventRank.event_id)}
                isFMC={isFMC()}
              />
            </div>
          </Match>
        </Switch>

        <div class="ms-4 flex items-center space-x-2 pb-2">
          <Select
            options={["value", "rank"]}
            value={metric()}
            onChange={(val) => {
              if (val) {
                setMetric(val as any);
              }
            }}
            itemComponent={(itemProps) => (
              <SelectItem item={itemProps.item}>
                {itemProps.item.rawValue === "value" ? "Result" : "Rank"}
              </SelectItem>
            )}
          >
            <SelectTrigger class="h-9 w-32 text-xs">
              <SelectValue>
                {(state) => (state.selectedOption() === "value" ? "Result" : "Rank")}
              </SelectValue>
            </SelectTrigger>
            <SelectContent />
          </Select>
          <DateRangePicker
            startDate={startDate()}
            onStartDateChange={setStartDate}
            endDate={endDate()}
            onEndDateChange={setEndDate}
            allowFuture={false}
          />
          <Button
            size="sm"
            onClick={applyDateRange}
            disabled={query.isFetching || !hasCompleteRange()}
            class="h-9 px-3"
          >
            Update
          </Button>
        </div>

        <hr class="mx-2" />
      </Collapsible.Content>
    </Collapsible>
  );
}
