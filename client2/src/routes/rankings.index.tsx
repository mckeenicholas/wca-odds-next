import { createSignal, createEffect, onCleanup, For, Show } from "solid-js";
import { createInfiniteQuery } from "@tanstack/solid-query";
import { createFileRoute, useNavigate } from "@tanstack/solid-router";
import { LoaderCircle, Globe, Trophy } from "lucide-solid";
import { z } from "zod";
import { CompetitorRankDropdown } from "../components/custom/CompetitorRankDropdown";
import { CountryFilterButton } from "../components/custom/CountryFilterButton";
import { CubingIcon } from "../components/custom/CubingIcon";
import { DatePicker } from "../components/custom/DatePicker";
import { ErrorPanel } from "../components/custom/ErrorPanel";
import { Button } from "../components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { Skeleton } from "../components/ui/skeleton";
import {
  eventNames,
  type CountryResult,
  type RankingSnapshot,
  type SupportedWCAEvent,
} from "../lib/types";
import { API_URL, isToday, renderTime, toNaiveDate } from "../lib/utils";

const rankingsSearchSchema = z.object({
  date: z.string().optional(),
  event: z.string().optional(),
});

export const Route = createFileRoute("/rankings/")({
  component: RankingsPage,
  validateSearch: (search) => rankingsSearchSchema.parse(search),
});

const PAGE_SIZE = 32;
const MAX_ITEMS = 512;

const getRankColName = (selectedCategory: string) => {
  switch (selectedCategory) {
    case "all": {
      return "Sum of Ranks";
    }
    case "kinch":
    case "kinch_strict": {
      return "Average Kinch score";
    }
    default: {
      return "Global Average";
    }
  }
};

const formatScore = (score: number, selectedCategory: string) => {
  if (selectedCategory === "all") {
    return score.toFixed(0);
  }
  if (["kinch", "kinch_strict"].includes(selectedCategory)) {
    return score.toFixed(2);
  }
  return renderTime(score, selectedCategory === "333fm");
};

function getEventLabel(val: string): string {
  if (val === "all") {
    return "Global (Sum-of-Ranks)";
  }
  if (val === "kinch") {
    return "Kinch (Competed Only)";
  }
  if (val === "kinch_strict") {
    return "Kinch (All Events Strict)";
  }
  return eventNames[val as keyof typeof eventNames] ?? val;
}

const EventOptionLabel = (props: { val: string }) => {
  const isWcaEvent = () => !["all", "kinch", "kinch_strict"].includes(props.val);
  return (
    <div class="flex items-center gap-2">
      <Show
        when={isWcaEvent()}
        fallback={
          <Show
            when={props.val === "all"}
            fallback={<Trophy class="h-4 w-4 shrink-0 opacity-60" />}
          >
            <Globe class="h-4 w-4 shrink-0 opacity-60" />
          </Show>
        }
      >
        <CubingIcon
          event={props.val as SupportedWCAEvent}
          class="h-4 w-4 shrink-0 text-muted-foreground"
          showTooltip={false}
        />
      </Show>
      <span class="truncate">{getEventLabel(props.val)}</span>
    </div>
  );
};

function RankingsPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();

  const initialDate = () => {
    const dStr = search().date;
    if (dStr) {
      const [year, month, day] = dStr.split("-");
      if (year && month && day) {
        const d = new Date(Number(year), Number(month) - 1, Number(day));
        if (!isNaN(d.getTime())) {
          return d;
        }
      }
    }
    return new Date();
  };

  const [rankDate, setRankDate] = createSignal<Date>(initialDate());
  const [committedDate, setCommittedDate] = createSignal<Date>(initialDate());
  const [selectedEvent, setSelectedEvent] = createSignal<string>(search().event ?? "all");
  const [selectedCountry, setSelectedCountry] = createSignal<CountryResult | undefined>();

  createEffect(() => {
    const dStr = search().date;
    if (dStr) {
      const [year, month, day] = dStr.split("-");
      if (year && month && day) {
        const d = new Date(Number(year), Number(month) - 1, Number(day));
        if (!isNaN(d.getTime())) {
          setRankDate(d);
          setCommittedDate(d);
        }
      }
    } else {
      setRankDate(new Date());
      setCommittedDate(new Date());
    }

    setSelectedEvent(search().event ?? "all");
  });

  const isDirty = () => rankDate().toDateString() !== committedDate().toDateString();

  const updateUrl = () => {
    const params: { date?: string; event?: string } = {};
    if (!isToday(committedDate())) {
      params.date = toNaiveDate(committedDate());
    }
    if (selectedEvent() !== "all") {
      params.event = selectedEvent();
    }
    void navigate({
      replace: true,
      search: params as any,
    });
  };

  createEffect(() => {
    selectedEvent();
    updateUrl();
  });

  const query = createInfiniteQuery(() => ({
    getNextPageParam: (lastPage: RankingSnapshot[], allPages: RankingSnapshot[][]) => {
      const totalLoaded = allPages.flat().length;
      if (lastPage.length < PAGE_SIZE || totalLoaded >= MAX_ITEMS) {
        // eslint-disable-next-line unicorn/no-useless-undefined
        return undefined;
      }
      return totalLoaded;
    },
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const dateVal = committedDate();
      const dateParam = isToday(dateVal) ? undefined : toNaiveDate(dateVal);
      const countryId = selectedCountry()?.id ?? undefined;
      const eventId = selectedEvent();
      const res = await fetch(`${API_URL}/api/rankings`, {
        body: JSON.stringify({
          country_id: countryId,
          date: dateParam,
          event_id: eventId,
          offset: pageParam,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      if (!res.ok) {
        throw new Error("Failed to fetch rankings");
      }
      const page: RankingSnapshot[] = await res.json();
      return page;
    },
    queryKey: [
      "rankings",
      selectedEvent(),
      committedDate().toDateString(),
      selectedCountry()?.id ?? "all",
    ],
  }));

  const allItems = () => query.data?.pages.flat() ?? [];

  let sentinelRef: HTMLDivElement | undefined;
  let observer: IntersectionObserver | undefined;

  createEffect(() => {
    const el = sentinelRef;
    if (observer) {
      observer.disconnect();
    }
    if (!el) {
      return;
    }
    observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && query.hasNextPage && !query.isFetchingNextPage) {
          void query.fetchNextPage();
        }
      },
      { threshold: 0.1 },
    );
    observer.observe(el);
    onCleanup(() => {
      observer?.disconnect();
    });
  });

  const applyDate = () => {
    setCommittedDate(new Date(rankDate()));
    updateUrl();
  };

  const setToday = () => {
    setRankDate(new Date());
    applyDate();
  };

  return (
    <div class="mx-2 flex flex-col items-center justify-center">
      <h1 class="mt-4 mb-4 text-center text-2xl font-bold">Rankings</h1>

      <div class="mb-2 flex flex-wrap items-center justify-center gap-2">
        <Select
          options={["all", "kinch", "kinch_strict", ...Object.keys(eventNames)]}
          value={selectedEvent()}
          onChange={(val) => {
            if (val) {
              setSelectedEvent(val);
            }
          }}
          itemComponent={(itemProps) => (
            <SelectItem item={itemProps.item}>
              <EventOptionLabel val={itemProps.item.rawValue} />
            </SelectItem>
          )}
        >
          <SelectTrigger class="h-9 w-64">
            <SelectValue>
              {(state) => {
                const val = state.selectedOption();
                return <EventOptionLabel val={val as string} />;
              }}
            </SelectValue>
          </SelectTrigger>
          <SelectContent />
        </Select>

        <CountryFilterButton
          value={selectedCountry()}
          onChange={setSelectedCountry}
          includeRegions={true}
        />
      </div>

      <div class="flex flex-col items-center gap-2">
        <div class="flex items-center gap-2">
          <DatePicker value={rankDate()} onChange={setRankDate} allowFuture={false} />
        </div>
        <div class="flex h-9 items-center gap-2">
          <Show when={!isToday(rankDate())}>
            <Button onClick={setToday} variant="outline" disabled={query.isPending} class="h-9">
              Today
            </Button>
          </Show>
          <Show when={isDirty()}>
            <Button onClick={applyDate} disabled={query.isPending} class="h-9">
              Update
            </Button>
          </Show>
        </div>
      </div>

      <Show when={query.isError}>
        <div class="mt-4">
          <ErrorPanel error={query.error?.message ?? "Unknown error"} />
        </div>
      </Show>

      <Show when={query.isPending && !query.isError}>
        <div class="mt-4 w-full max-w-4xl">
          <div class="rounded-md border px-4 py-2">
            <For each={Array.from({ length: 10 })}>
              {() => <Skeleton class="my-4 h-9 w-full" />}
            </For>
          </div>
        </div>
      </Show>

      <Show when={!query.isPending && !query.isError}>
        <Show
          when={allItems().length > 0}
          fallback={
            <div class="mt-8 text-center text-muted-foreground">
              No ranking data found for the selected event and timeframe.
            </div>
          }
        >
          <div class="mt-2 w-full max-w-4xl">
            <div class="rounded-md border">
              <div class="flex w-full justify-between p-2 ps-1 text-sm font-medium text-muted-foreground">
                <Show when={selectedCountry()}>
                  <div class="w-16 shrink-0 ps-3 text-left md:w-28">Region Rank</div>
                </Show>
                <div class="w-20 shrink-0 ps-3 text-left md:w-28">
                  {selectedCountry() ? "Global Rank" : "Rank"}
                </div>
                <div class="min-w-0 flex-2 text-left">Name</div>
                <div class="flex-1 pe-3 text-right">{getRankColName(selectedEvent())}</div>
                <div class="w-6" />
              </div>
              <hr class="mx-2" />
              <ol>
                <For each={allItems()}>
                  {(competitor, index) => (
                    <li class="rounded-md p-1 contain-content">
                      <CompetitorRankDropdown
                        competitor={competitor}
                        index={index()}
                        selectedEvent={selectedEvent()}
                        formattedScore={formatScore(competitor.score.current, selectedEvent())}
                        rankDate={committedDate()}
                        showRegionRank={Boolean(selectedCountry())}
                      />
                    </li>
                  )}
                </For>
              </ol>

              {/* Infinite scroll sentinel */}
              <div
                ref={(el) => {
                  sentinelRef = el;
                }}
                class="h-1"
              />

              {/* Loading more indicator */}
              <Show when={query.isFetchingNextPage}>
                <div class="flex justify-center py-4">
                  <LoaderCircle class="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              </Show>

              {/* End of results */}
              <Show when={!query.hasNextPage && allItems().length > PAGE_SIZE}>
                <div class="border-t py-3 text-center text-sm text-muted-foreground">
                  Showing all {allItems().length} results
                </div>
              </Show>
            </div>
          </div>
        </Show>
      </Show>
    </div>
  );
}
