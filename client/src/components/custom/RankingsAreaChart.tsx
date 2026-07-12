import type { RankingHistoryPoint } from "../../lib/types";
import { createSignal, For, Show } from "solid-js";
import { renderTime } from "../../lib/utils";

interface RankingsAreaChartProps {
  history: RankingHistoryPoint[];
  metric: "value" | "rank";
  isTime?: boolean;
  isFMC?: boolean;
}

export function RankingsAreaChart(props: RankingsAreaChartProps) {
  const [hoveredPoint, setHoveredPoint] = createSignal<{
    x: number;
    y: number;
    date: string;
    value: number;
    rank: number;
  } | null>(null);

  const points = () =>
    props.history
      .map((item) => {
        const [comp] = item.competitors;
        if (!comp) {
          return null;
        }
        return {
          date: new Date(`${item.date}T12:00:00`),
          dateStr: item.date,
          rank: comp.rank,
          value: comp.value,
        };
      })
      .filter((p): p is { date: Date; dateStr: string; rank: number; value: number } => p !== null)
      .toSorted((a, b) => a.date.getTime() - b.date.getTime());

  const width = 600;
  const height = 240;
  const paddingLeft = 60;
  const paddingRight = 20;
  const paddingTop = 20;
  const paddingBottom = 40;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  const xCoords = () => {
    const list = points();
    if (list.length === 0) {
      return [];
    }
    if (list.length === 1) {
      return [paddingLeft + chartWidth / 2];
    }

    const minTime = list.at(0)!.date.getTime();
    const maxTime = list.at(-1)!.date.getTime();
    const range = maxTime - minTime || 1;

    return list.map((p) => {
      const pct = (p.date.getTime() - minTime) / range;
      return paddingLeft + pct * chartWidth;
    });
  };

  const yRange = () => {
    const list = points();
    if (list.length === 0) {
      return { max: 10, min: 0 };
    }
    const values = list.map((p) => (props.metric === "value" ? p.value : p.rank));
    const min = Math.min(...values);
    const max = Math.max(...values);
    return { max, min };
  };

  const yCoords = () => {
    const list = points();
    const range = yRange();
    if (list.length === 0) {
      return [];
    }

    const diff = range.max - range.min || 1;

    return list.map((p) => {
      const val = props.metric === "value" ? p.value : p.rank;
      const pct = (val - range.min) / diff;
      const yPct = props.metric === "rank" ? pct : 1 - pct;
      return paddingTop + yPct * chartHeight;
    });
  };

  const pathData = () => {
    const xs = xCoords();
    const ys = yCoords();
    if (xs.length === 0) {
      return "";
    }
    return xs.map((x, i) => `${i === 0 ? "M" : "L"} ${x} ${ys[i]}`).join(" ");
  };

  const yTicks = () => {
    const range = yRange();
    const ticksCount = 5;
    const ticks = [];
    const step = (range.max - range.min) / (ticksCount - 1) || 1;
    for (let i = 0; i < ticksCount; i++) {
      const val = range.min + i * step;
      const pct = (val - range.min) / (range.max - range.min || 1);
      const yPct = props.metric === "rank" ? pct : 1 - pct;
      const y = paddingTop + yPct * chartHeight;
      ticks.push({ val, y });
    }
    return ticks;
  };

  const xTicks = () => {
    const list = points();
    if (list.length < 2) {
      return [];
    }
    const ticksCount = 3;
    const step = Math.floor(list.length / (ticksCount - 1)) || 1;
    const ticks = [];
    const xs = xCoords();
    for (let i = 0; i < ticksCount; i++) {
      const idx = Math.min(i * step, list.length - 1);
      const p = list[idx];
      const x = xs[idx];
      const label = p.date.toLocaleDateString(undefined, {
        month: "short",
        year: "numeric",
      });
      ticks.push({ label, x });
    }
    return ticks;
  };

  const formatValue = (v: number) => {
    if (props.metric === "rank") {
      return v.toFixed(0);
    }
    if (props.isTime) {
      return renderTime(v, props.isFMC ?? false);
    }
    return v.toFixed(1);
  };

  const handleMouseMove = (e: MouseEvent) => {
    const rect = (e.currentTarget as SVGElement).getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const xs = xCoords();
    const list = points();
    const ys = yCoords();
    if (xs.length === 0) {
      return;
    }

    let closestIdx = 0;
    let minDiff = Math.abs(xs[0] - mouseX);
    for (let i = 1; i < xs.length; i++) {
      const diff = Math.abs(xs[i] - mouseX);
      if (diff < minDiff) {
        minDiff = diff;
        closestIdx = i;
      }
    }

    const p = list[closestIdx];
    setHoveredPoint({
      date: p.date.toLocaleDateString(undefined, { dateStyle: "medium" }),
      rank: p.rank,
      value: p.value,
      x: xs[closestIdx],
      y: ys[closestIdx],
    });
  };

  return (
    <div class="flex w-full flex-col items-center select-none">
      <Show
        when={points().length > 0}
        fallback={
          <div class="flex h-[240px] items-center justify-center text-sm text-muted-foreground">
            No history available
          </div>
        }
      >
        <div class="relative h-[240px] w-full max-w-[600px]">
          <svg
            class="h-full w-full text-muted-foreground"
            viewBox={`0 0 ${width} ${height}`}
            onMouseMove={handleMouseMove}
            onMouseLeave={() => {
              setHoveredPoint(null);
            }}
          >
            {/* Grid lines */}
            <For each={yTicks()}>
              {(t) => (
                <>
                  <line
                    x1={paddingLeft}
                    y1={t.y}
                    x2={width - paddingRight}
                    y2={t.y}
                    class="stroke-border"
                    stroke-width="1"
                    stroke-dasharray="2 2"
                  />
                  <text
                    x={paddingLeft - 8}
                    y={t.y + 4}
                    class="fill-muted-foreground text-right text-[10px]"
                    text-anchor="end"
                  >
                    {formatValue(t.val)}
                  </text>
                </>
              )}
            </For>

            {/* X axis labels */}
            <For each={xTicks()}>
              {(t) => (
                <text
                  x={t.x}
                  y={height - paddingBottom + 16}
                  class="fill-muted-foreground text-center text-[10px]"
                  text-anchor="middle"
                >
                  {t.label}
                </text>
              )}
            </For>

            {/* Line path */}
            <path
              d={pathData()}
              fill="none"
              class="stroke-primary"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />

            {/* Hover vertical bar and tooltip info */}
            <Show when={hoveredPoint()}>
              {(hp) => (
                <>
                  <line
                    x1={hp().x}
                    y1={paddingTop}
                    x2={hp().x}
                    y2={height - paddingBottom}
                    class="stroke-muted-foreground"
                    stroke-width="1"
                    stroke-dasharray="3 3"
                  />
                  <circle
                    cx={hp().x}
                    cy={hp().y}
                    r="4"
                    class="fill-primary stroke-background"
                    stroke-width="2"
                  />
                </>
              )}
            </Show>
          </svg>

          {/* Tooltip Overlay */}
          <Show when={hoveredPoint()}>
            {(hp) => (
              <div
                class="pointer-events-none absolute z-20 rounded-md border bg-popover p-2 text-xs text-popover-foreground shadow-md"
                style={{
                  left: `${hp().x + 10}px`,
                  top: `${hp().y - 40}px`,
                  transform: hp().x > width - 150 ? "translateX(-110%)" : "none",
                }}
              >
                <div class="font-semibold">{hp().date}</div>
                <div class="mt-1 flex flex-col gap-0.5">
                  <div>
                    Result: <span class="font-medium">{formatValue(hp().value)}</span>
                  </div>
                  <div>
                    Rank: <span class="font-medium">{hp().rank}</span>
                  </div>
                </div>
              </div>
            )}
          </Show>
        </div>
      </Show>
    </div>
  );
}
