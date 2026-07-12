import type { SimulationAPIResults } from "../../lib/types";
import { VisSingleContainer, VisDonut, VisTooltip } from "@unovis/solid";
import { Donut } from "@unovis/ts";

interface PieChartProps {
  data: SimulationAPIResults;
  colors: string[];
}

const value = (d: any) => d.wins;

export function PieChart(props: PieChartProps) {
  const chartData = () =>
    props.data.competitor_results.map((item) => ({
      name: item.name,
      wins: item.win_chance * 100,
    }));

  const color = (_d: any, i: number) => props.colors[i];

  const tooltipTriggers = {
    [Donut.selectors.segment]: (d: any) => {
      const idx = props.data.competitor_results.findIndex((c) => c.name === d.data.name);
      const segmentColor = props.colors[idx] ?? "#888888";
      return `<div class="relative z-50 flex items-center gap-2 rounded bg-popover p-2 text-sm text-popover-foreground">
        <span class="inline-block h-2.5 w-2.5 rounded-full" style="background-color: ${segmentColor}"></span>
        <span>${d.data.name}: <strong class="ms-2">${d.data.wins.toFixed(2)}%</strong></span>
      </div>`;
    },
  };

  return (
    <div class="flex w-full max-w-96 items-center justify-center">
      <VisSingleContainer data={chartData()} height={180} width={180}>
        <VisDonut value={value} color={color} arcWidth={0} />
        <VisTooltip triggers={tooltipTriggers} />
      </VisSingleContainer>
    </div>
  );
}
