import type { HistoryChartMetric, HistoryPoint } from "../../lib/types";
import { createMemo, Show, For } from "solid-js";
import { VisXYContainer, VisArea, VisLine, VisAxis, VisCrosshair, VisTooltip } from "@unovis/solid";
import { CurveType, Line } from "@unovis/ts";
import { formatPercentage } from "../../lib/utils";

interface StackedAreaChartProps {
  history: HistoryPoint[];
  stacked?: boolean;
  metric: HistoryChartMetric;
  class?: string;
}

const x = (d: Record<string, number>) => d.date;

const dateFormatter = (timestamp: number | Date) => {
  const timeVal = typeof timestamp === "number" ? timestamp : timestamp.getTime();
  return new Date(timeVal).toLocaleDateString(undefined, {
    month: "short",
    year: "numeric",
  });
};

export function StackedAreaChart(props: StackedAreaChartProps) {
  const isStacked = () => props.stacked !== false && props.metric !== "rank";

  const competitorMeta = createMemo(() => {
    if (!props.history || props.history.length === 0) {
      return [];
    }
    const lastEntry = props.history.at(-1);
    if (!lastEntry) {
      return [];
    }
    const meta = lastEntry.competitors.map((c) => {
      let finalVal = 0;
      if (props.metric === "win") {
        finalVal = c.win_chance;
      } else if (props.metric === "podium") {
        finalVal = c.pod_chance;
      } else if (props.metric === "rank") {
        finalVal = -c.expected_rank;
      }
      return {
        color: c.color ?? "#888888",
        finalVal,
        id: c.id,
        name: c.name,
      };
    });
    meta.sort((a, b) => a.finalVal - b.finalVal);
    return meta;
  });

  const processedData = createMemo(() => {
    if (!props.history || props.history.length === 0) {
      return [];
    }
    return props.history.map((point) => {
      const dataPoint: Record<string, number> = {
        date: new Date(`${point.date}T12:00:00`).getTime(),
      };
      point.competitors.forEach((c) => {
        let val = 0;
        if (props.metric === "win") {
          val = c.win_chance * 100;
        } else if (props.metric === "podium") {
          val = c.pod_chance * 100;
        } else if (props.metric === "rank") {
          val = c.expected_rank;
        }
        dataPoint[c.id] = val;
      });
      return dataPoint;
    });
  });

  const yDomain = createMemo<[number, number]>(() => {
    if (props.metric === "rank") {
      const allRanks = processedData().flatMap((d) => competitorMeta().map((m) => d[m.id]));
      const maxRank = Math.max(...allRanks, 3);
      return [maxRank + 0.5, 1];
    }
    return [0, 100];
  });

  const yTickFormat = (v: number | Date) => {
    const num = typeof v === "number" ? v : v.getTime();
    if (props.metric === "rank") {
      return num.toFixed(1);
    }
    return `${Math.round(num)}%`;
  };

  const yStacked = createMemo(() =>
    competitorMeta().map((meta) => (d: Record<string, number>) => d[meta.id] || 0),
  );

  const yStackedCumulative = createMemo(() => {
    const meta = competitorMeta();
    return meta.map((_, i) => {
      const idsSlice = meta.slice(0, i + 1).map((m) => m.id);
      return (d: Record<string, number>) => {
        let sum = 0;
        for (const id of idsSlice) {
          sum += d[id] || 0;
        }
        return sum;
      };
    });
  });

  const stackedColorAccessor = (_d: unknown, i: number) => competitorMeta()[i]?.color ?? "#888888";

  const tooltipTemplate = (d: Record<string, number>) => {
    const dateVal = new Date(d.date);
    const dateDisplay = dateVal.toLocaleDateString(undefined, {
      month: "long",
      year: "numeric",
    });

    const sortedCompValues = competitorMeta()
      .map((meta) => ({
        name: meta.name,
        color: meta.color,
        value: d[meta.id] ?? 0,
      }))
      .toSorted((a, b) => b.value - a.value);

    return (
      <div class="relative z-50 rounded-md bg-popover p-2 text-sm text-popover-foreground">
        <p class="mb-1 border-b border-border pb-1 font-bold text-foreground">{dateDisplay}</p>
        <For each={sortedCompValues}>
          {(item) => (
            <div class="flex justify-between">
              <div class="flex items-center">
                <span
                  class="mr-2 inline-block h-2.5 w-2.5 rounded-full"
                  style={{ "background-color": item.color }}
                />
                <span>{item.name}</span>
              </div>
              <span class="ml-4 font-semibold">
                {props.metric === "rank" ? item.value.toFixed(2) : formatPercentage(item.value)}
              </span>
            </div>
          )}
        </For>
      </div>
    ) as HTMLElement;
  };

  const crosshairY = createMemo(() => {
    if (isStacked()) {
      return yStackedCumulative();
    }
    return competitorMeta().map((comp) => (d: Record<string, number>) => d[comp.id] || 0);
  });

  return (
    <div class={`h-full w-full ${props.class ?? ""}`}>
      <VisXYContainer data={processedData()} height={300} yDomain={yDomain()}>
        <svg width="0" height="0">
          <defs>
            <For each={competitorMeta()}>
              {(comp) => (
                <linearGradient id={`grad-stack-${comp.id}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stop-color={comp.color} stop-opacity="0.4" />
                  <stop offset="100%" stop-color={comp.color} stop-opacity="0" />
                </linearGradient>
              )}
            </For>
          </defs>
        </svg>
        <Show
          when={isStacked()}
          fallback={competitorMeta().map((comp) => (
            <>
              <VisArea
                x={x}
                y={(d: Record<string, number>) => d[comp.id] || 0}
                color={`url(#grad-stack-${comp.id})`}
                curveType={CurveType.MonotoneX}
              />
              <VisLine
                x={x}
                y={(d: Record<string, number>) => d[comp.id] || 0}
                color={comp.color}
                curveType={CurveType.MonotoneX}
                attributes={{
                  [Line.selectors.line]: {
                    strokeWidth: 2,
                  },
                }}
              />
            </>
          ))}
        >
          <VisArea
            x={x}
            y={yStacked()}
            color={stackedColorAccessor}
            curveType={CurveType.MonotoneX}
            opacity={0.8}
          />
        </Show>
        <VisAxis type="x" tickFormat={dateFormatter} gridLine={false} numTicks={6} />
        <VisAxis type="y" tickFormat={yTickFormat} gridLine={true} />
        <VisCrosshair
          template={tooltipTemplate}
          x={x}
          y={crosshairY()}
          color={stackedColorAccessor}
        />
        <VisTooltip horizontalShift={15} />
      </VisXYContainer>
    </div>
  );
}
