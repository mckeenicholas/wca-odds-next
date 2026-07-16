import type { RankingHistoryPoint } from "../../lib/types";
import { createMemo, For, Show } from "solid-js";
import { render } from "solid-js/web";
import { VisXYContainer, VisArea, VisLine, VisAxis, VisCrosshair, VisTooltip } from "@unovis/solid";
import { CurveType, Line } from "@unovis/ts";
import { renderTime } from "../../lib/utils";

interface RankingsAreaChartProps {
  history: RankingHistoryPoint[];
  stacked?: boolean;
  filterOpacity?: number;
  showGradient?: boolean;
  metric: "value" | "rank";
  isTime?: boolean;
  isFMC?: boolean;
}

const x = (d: Record<string, number>) => d.date;

const dateFormatter = (timestamp: number | Date) => {
  const timeVal = typeof timestamp === "number" ? timestamp : timestamp.getTime();
  return new Date(timeVal).toLocaleDateString(undefined, {
    month: "short",
    year: "numeric",
  });
};

export function RankingsAreaChart(props: RankingsAreaChartProps) {
  const stacked = () => props.stacked ?? false; // Default to false since detailed competitor history is typically line-only
  const showGradient = () => props.showGradient ?? true;

  const competitorMeta = createMemo(() => {
    if (!props.history?.length) {
      return [];
    }

    const lastEntry = props.history.at(-1)!;

    const meta = lastEntry.competitors.map((c) => {
      let finalVal = 0;
      switch (props.metric) {
        case "value":
          finalVal = c.value;
          break;
        case "rank":
          finalVal = -c.rank;
          break;
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
    if (!props.history?.length) {
      return [];
    }

    return props.history.map((point) => {
      const dataPoint: Record<string, number> = {
        date: new Date(`${point.date}T12:00:00`).getTime(),
      };

      point.competitors.forEach((c) => {
        let val = 0;
        if (props.metric === "value") {
          val = c.value;
        } else if (props.metric === "rank") {
          val = c.rank;
        }
        dataPoint[c.name] = val;
      });

      return dataPoint;
    });
  });

  const yRange = createMemo<[number, number]>(() => {
    const allValues = processedData().flatMap((d) => competitorMeta().map((m) => d[m.name]));

    if (allValues.length === 0) {
      return [0, 10];
    }

    const maxVal = Math.max(...allValues);
    const minVal = Math.min(...allValues);

    if (props.metric === "rank") {
      const bottom = Math.max(1, minVal - 1);
      const top = Math.max(5, maxVal + 1);
      return [bottom, top];
    }

    if (minVal === maxVal) {
      const buffer = minVal === 0 ? 10 : Math.abs(minVal * 0.1);
      return [Math.max(0, minVal - buffer), maxVal + buffer];
    }

    const buffer = (maxVal - minVal) * 0.1;
    return [Math.max(0, minVal - buffer), maxVal + buffer];
  });

  const yTickFormat = (v: number | Date) => {
    const num = typeof v === "number" ? v : v.getTime();
    if (props.metric === "rank") {
      if (num % 1 !== 0) {
        return "";
      }
      return num.toFixed(0);
    }
    if (props.isTime) {
      return renderTime(num, props.isFMC ?? false);
    }
    return num.toFixed(1);
  };

  const tooltipTemplate = (d: Record<string, number>) => {
    const dateVal = new Date(d.date);
    const dateDisplay = dateVal.toLocaleDateString(undefined, {
      month: "long",
      year: "numeric",
    });

    const isRank = props.metric === "rank";

    const sortedCompValues = competitorMeta()
      .map((meta) => ({
        name: meta.name,
        color: meta.color,
        value: d[meta.name] ?? 0,
      }))
      .toSorted((a, b) => {
        if (isRank) {
          return a.value - b.value; // Lower rank is better (1 is best), show on top
        }
        return b.value - a.value;
      });

    const container = document.createElement("div");
    render(
      () => (
        <div class="relative z-50 rounded-md border bg-popover p-2 font-sans text-xs text-popover-foreground shadow-md">
          <p class="mb-1 border-b border-border pb-1 font-semibold text-foreground">
            {dateDisplay}
          </p>
          <For each={sortedCompValues}>
            {(item) => (
              <div class="flex justify-between gap-4 py-0.5">
                <div class="flex items-center">
                  <span
                    class="mr-2 inline-block h-2 w-2 rounded-full"
                    style={{ "background-color": item.color }}
                  />
                  <span>{item.name}</span>
                </div>
                <span class="font-semibold">{yTickFormat(item.value)}</span>
              </div>
            )}
          </For>
        </div>
      ),
      container,
    );

    return container.firstChild as HTMLElement;
  };

  const crosshairY = createMemo(() =>
    competitorMeta().map((meta) => (d: Record<string, number>) => d[meta.name] || 0),
  );

  const colorAccessor = (_d: unknown, i: number) => competitorMeta()[i]?.color ?? "#888888";

  return (
    <div
      class="flex h-60 w-full flex-col items-end select-none"
      style={{
        "--vis-text-color": "#888888",
        "--vis-axis-grid-color": "#e5e7eb",
      }}
    >
      <Show
        when={processedData().length > 0}
        fallback={
          <div class="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
            No data available
          </div>
        }
      >
        <VisXYContainer
          data={processedData()}
          height={240}
          margin={{ left: 25, right: 20 }}
          yDomain={yRange()}
        >
          <svg width="0" height="0">
            <defs>
              <For each={competitorMeta()}>
                {(comp, i) => (
                  <linearGradient id={`color-${i()}`} x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="5%"
                      stop-color={comp.color}
                      stop-opacity={showGradient() ? 0.4 : 0}
                    />
                    <stop offset="95%" stop-color={comp.color} stop-opacity="0" />
                  </linearGradient>
                )}
              </For>
            </defs>
          </svg>

          <Show
            when={stacked()}
            fallback={
              <For each={competitorMeta()}>
                {(comp, i) => (
                  <>
                    <VisArea
                      x={x}
                      y={(d: Record<string, number>) => d[comp.name] || 0}
                      color={`url(#color-${i()})`}
                      curveType={CurveType.MonotoneX}
                      opacity={1}
                    />
                    <VisLine
                      x={x}
                      y={(d: Record<string, number>) => d[comp.name] || 0}
                      color={comp.color}
                      curveType={CurveType.MonotoneX}
                      attributes={{
                        [Line.selectors.line]: {
                          strokeWidth: 2,
                        },
                      }}
                    />
                  </>
                )}
              </For>
            }
          >
            <VisArea
              x={x}
              y={crosshairY()}
              color={colorAccessor}
              curveType={CurveType.MonotoneX}
              opacity={0.8}
            />
          </Show>

          <VisAxis
            type="x"
            tickFormat={dateFormatter}
            gridLine={false}
            tickLine={false}
            tickTextColor="var(--vis-text-color)"
            numTicks={6}
          />

          <VisAxis
            type="y"
            tickLine={false}
            domainLine={false}
            gridLine={true}
            tickTextColor="var(--vis-text-color)"
            tickFormat={yTickFormat}
          />

          <VisCrosshair template={tooltipTemplate} x={x} y={crosshairY()} color={colorAccessor} />
          <VisTooltip horizontalShift={15} />
        </VisXYContainer>
      </Show>
    </div>
  );
}
