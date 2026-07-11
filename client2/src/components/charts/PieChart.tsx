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
    [Donut.selectors.segment]: (d: any) =>
      `<div class="relative z-50 p-2 text-sm bg-popover text-popover-foreground rounded"><strong>${d.data.name}</strong>: ${d.data.wins.toFixed(2)}%</div>`,
  };

  return (
    <div class="flex w-full max-w-96 items-center justify-center">
      <VisSingleContainer data={chartData()} height={180} width={180}>
        <VisDonut value={value} color={color} arcWidth={40} />
        <VisTooltip triggers={tooltipTriggers} />
      </VisSingleContainer>
    </div>
  );
}
