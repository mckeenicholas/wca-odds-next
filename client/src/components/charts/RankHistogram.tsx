import type { ChartData } from "../../lib/types";
import { createMemo, For } from "solid-js";
import { VisXYContainer, VisStackedBar, VisAxis, VisCrosshair, VisTooltip } from "@unovis/solid";
import { formatPercentage } from "../../lib/utils";

const toPlaceString = (place: number): string => {
  const suffixes = ["th", "st", "nd", "rd"];
  const mod100 = place % 100;

  if (mod100 >= 11 && mod100 <= 13) {
    return `${place}th`;
  }

  const suffix = suffixes[place % 10] || suffixes[0];
  return `${place}${suffix}`;
};

interface RankHistogramProps {
  data: ChartData;
  colors: string[];
}

interface RankChartDataPoint {
  name: string;
  [label: string]: string | number;
}

const x = (_d: unknown, i: number) => i;

export function RankHistogram(props: RankHistogramProps) {
  const chartData = createMemo(() =>
    props.data.data.map((point) => {
      const result: RankChartDataPoint = { name: point.name };
      props.data.labels.forEach((label, index) => {
        result[label] = point.values[index];
      });
      return result;
    }),
  );

  const xTicks = (tick: number | Date, i: number) => {
    const point = chartData()[i];
    if (!point) {
      return "";
    }
    const n = Number(point.name);
    if (!Number.isInteger(n)) {
      return "";
    }
    return n.toString();
  };

  const categories = () => props.data.labels;
  const y = () => categories().map((label) => (d: RankChartDataPoint) => d[label] as number);
  const color = (_d: unknown, i: number) => props.colors[i];

  const tooltipTemplate = (d: RankChartDataPoint) => {
    const items = categories()
      .map((category, idx) => {
        const val = d[category] as number;
        if (val === undefined || val === 0) {
          return null;
        }
        return { category, val, color: props.colors[idx] };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);

    return (
      <div class="relative z-50 rounded-md bg-popover p-2 text-sm text-popover-foreground">
        <p class="font-bold text-foreground">{toPlaceString(Math.trunc(Number(d.name)))}</p>
        <For each={items}>
          {(item) => (
            <div class="flex justify-between">
              <div class="flex items-center">
                <span
                  class="mr-2 inline-block h-2.5 w-2.5 rounded-full"
                  style={{ "background-color": item.color }}
                />
                <span>{item.category}</span>
              </div>
              <span class="ml-4 font-semibold">{formatPercentage(item.val)}</span>
            </div>
          )}
        </For>
      </div>
    ) as HTMLElement;
  };

  return (
    <div class="mx-4 mt-2 mb-4">
      <div class="h-[240px]">
        <VisXYContainer data={chartData()} height={240}>
          <VisStackedBar x={x} y={y()} color={color} />
          <VisAxis type="x" tickFormat={xTicks} gridLine={false} domainLine={false} />
          <VisAxis
            type="y"
            tickFormat={(v: number | Date) => `${typeof v === "number" ? v : v.getTime()}%`}
            gridLine={true}
            domainLine={false}
          />
          <VisCrosshair template={tooltipTemplate} x={x} y={y()} color={color} />
          <VisTooltip horizontalShift={15} />
        </VisXYContainer>
      </div>
    </div>
  );
}
