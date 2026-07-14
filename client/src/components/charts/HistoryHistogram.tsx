import type { HistoryChartMetric, HistoryPoint } from "../../lib/types";
import { createSignal, createMemo, Show } from "solid-js";
import { createQuery } from "@tanstack/solid-query";

const METRIC_LABELS: Record<HistoryChartMetric, string> = {
  win: "Win Probability",
  podium: "Podium Probability",
  rank: "Expected Rank",
};
import { LoaderCircle } from "lucide-solid";
import { buildUrl } from "../../lib/utils";
import { Button } from "../ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "../ui/select";
import { MultiLabelSwitch } from "./MultiLabelSwitch";
import { StackedAreaChart } from "./StackedAreaChart";

interface HistoryHistogramProps {
  competitors: { id: string; color: string }[];
  data: {
    event_id: string;
    start_date: string;
    end_date: string;
    half_life: number;
    include_dnf: boolean;
  };
}

export function HistoryHistogram(props: HistoryHistogramProps) {
  const [metric, setMetric] = createSignal<HistoryChartMetric>("win");
  const [isOverlap, setIsOverlap] = createSignal(false);

  const queryPayload = createMemo(() => ({
    competitor_ids: props.competitors.map((c) => c.id),
    ...props.data,
  }));

  const fetchHistory = async (): Promise<HistoryPoint[]> => {
    const response = await fetch(buildUrl("/api/history"), {
      body: JSON.stringify(queryPayload()),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });

    if (!response.ok) {
      throw new Error(`Error: ${response.statusText}`);
    }

    const rawResult: HistoryPoint[] = await response.json();

    return rawResult.map((point) => ({
      ...point,
      competitors: point.competitors.map((competitor) => ({
        ...competitor,
        color: props.competitors.find((c) => c.id === competitor.id)?.color ?? "#888888",
      })),
    }));
  };

  const query = createQuery(() => ({
    enabled: props.competitors && props.competitors.length > 0,
    queryFn: fetchHistory,
    queryKey: ["simulation-history", queryPayload()],
    retry: false,
    staleTime: Infinity,
  }));

  const chartData = createMemo(() => {
    const dataVal = query.data;
    if (!dataVal) {
      return null;
    }

    return dataVal.map((point) => {
      const competitorList = point.competitors.map((c) => {
        let value = 0;
        if (metric() === "win") {
          value = c.win_chance * 100;
        } else if (metric() === "podium") {
          value = c.pod_chance * 100;
        } else if (metric() === "rank") {
          value = c.expected_rank;
        }
        return { ...c, displayValue: value };
      });
      return { ...point, competitors: competitorList };
    });
  });

  return (
    <div class="mx-4 mt-2 mb-4 text-card-foreground">
      <div class="relative min-h-75">
        <Show when={query.isPending}>
          <div class="absolute inset-0 z-10 flex flex-col items-center justify-center space-y-2 bg-background/50">
            <LoaderCircle class="h-8 w-8 animate-spin text-muted-foreground" />
            <p class="text-sm text-muted-foreground">Generating...</p>
          </div>
        </Show>

        <Show when={query.isError}>
          <div class="flex h-75 w-full flex-col items-center justify-center gap-2 rounded-md border bg-background">
            <p class="text-sm text-red-500">{query.error?.message ?? "Failed to load history"}</p>
            <Button
              onClick={() => query.refetch()}
              variant="link"
              class="text-xs text-muted-foreground underline hover:text-foreground"
            >
              Try Again
            </Button>
          </div>
        </Show>

        <Show when={chartData()}>
          {(dataPoints) => (
            <>
              <StackedAreaChart
                history={dataPoints()}
                stacked={!isOverlap()}
                metric={metric()}
                class="h-75 w-full"
              />
              <div class="mt-6 flex flex-wrap items-center gap-4 px-2">
                <Select
                  options={["win", "podium", "rank"] as HistoryChartMetric[]}
                  value={metric()}
                  onChange={(val) => {
                    if (val) {
                      setMetric(val);
                    }
                  }}
                  itemComponent={(itemProps) => (
                    <SelectItem item={itemProps.item}>
                      {METRIC_LABELS[itemProps.item.rawValue]}
                    </SelectItem>
                  )}
                >
                  <SelectTrigger class="h-8 w-44 text-xs font-normal">
                    <SelectValue>
                      {(state) => {
                        const val = state.selectedOption() as HistoryChartMetric;
                        return METRIC_LABELS[val];
                      }}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent />
                </Select>

                <Show when={metric() !== "rank"}>
                  <MultiLabelSwitch
                    left="Stacked"
                    right="Overlap"
                    checked={isOverlap()}
                    onChange={setIsOverlap}
                  />
                </Show>
              </div>
            </>
          )}
        </Show>
      </div>
    </div>
  );
}
