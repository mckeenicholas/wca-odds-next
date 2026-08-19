import type { RankingSnapshot } from "../../lib/types";
import { createSignal, Show, Switch, Match } from "solid-js";
import { Collapsible } from "@kobalte/core/collapsible";
import { LoaderCircle } from "lucide-solid";
import { useRankDetail } from "../../lib/useRankDetail";
import { cn, isTimeEvent } from "../../lib/utils";
import { MultiLabelSwitch } from "../charts/MultiLabelSwitch";
import { Button } from "../ui/button";
import { CompetitorLink } from "./CompetitorLink";
import { DateRangePicker } from "./DateRangePicker";
import { RankChangeIndicator } from "./RankChangeIndicator";
import { RankingsAreaChart } from "./RankingsAreaChart";
import { RotatableChevron } from "./RotatableChevron";

interface CompetitorRankDropdownProps {
  competitor: RankingSnapshot;
  selectedEvent: string;
  formattedScore: string;
  rankDate: Date;
  index: number;
  showRegionRank?: boolean;
}

export function CompetitorRankDropdown(props: CompetitorRankDropdownProps) {
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
    competitorId: () => props.competitor.person_id,
    competitorName: () => props.competitor.name,
    eventId: () => props.selectedEvent,
    isOpen,
    rankDate: () => props.rankDate,
  });

  const ariaId = () => `details-${props.competitor.person_id}`;

  return (
    <Collapsible open={isOpen()} onOpenChange={setIsOpen}>
      <Collapsible.Trigger
        aria-controls={ariaId()}
        class={cn(
          "flex w-full cursor-pointer justify-between rounded-md border-0 bg-transparent p-2 ps-1 text-left text-sm hover:bg-secondary focus:outline-none focus-visible:bg-secondary",
          props.index % 2 === 0 && "bg-muted/20",
        )}
      >
        <Show when={props.showRegionRank && props.competitor.sub_rank}>
          <div class="flex w-16 shrink-0 items-center gap-1 ps-3 text-left text-xs sm:text-sm md:w-28">
            <span>{props.competitor.sub_rank!.rank}</span>
            <RankChangeIndicator change={props.competitor.sub_rank!.rank_change} />
          </div>
        </Show>
        <div class="flex w-20 shrink-0 items-center gap-1 ps-3 text-left text-foreground md:w-28">
          <span>{props.competitor.global_rank.current}</span>
          <RankChangeIndicator change={props.competitor.global_rank.change} />
        </div>
        <div class="min-w-0 flex-2 text-left">
          <CompetitorLink
            name={props.competitor.name}
            id={props.competitor.person_id}
            iso2={props.competitor.country_iso2}
            class="flex flex-row items-center"
          />
        </div>
        <div class="flex-1 pe-3 text-right">{props.formattedScore}</div>
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
            <div class="relative px-4 py-2">
              <Show when={query.isFetching}>
                <div class="absolute inset-0 z-10 flex items-center justify-center rounded-md bg-background/50">
                  <LoaderCircle class="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              </Show>

              <RankingsAreaChart
                history={mappedHistory()}
                metric={metric()}
                isTime={isTimeEvent(props.selectedEvent)}
                isFMC={props.selectedEvent === "333fm"}
              />
            </div>
          </Match>
        </Switch>

        <div class="ms-4 flex items-center gap-2 pb-2">
          <MultiLabelSwitch
            left="Result"
            right="Rank"
            checked={metric() === "rank"}
            onChange={(val) => setMetric(val ? "rank" : "value")}
            class="mr-2 text-xs"
          />

          <DateRangePicker
            startDate={startDate()}
            onStartDateChange={setStartDate}
            endDate={endDate()}
            onEndDateChange={setEndDate}
            allowFuture={false}
          />

          <Button
            size="sm"
            disabled={query.isFetching || !hasCompleteRange()}
            onClick={applyDateRange}
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
