import type { ChartData, SimulationResultProps } from "../../lib/types";
import { createSignal, createMemo, createEffect, For, Index } from "solid-js";
import { render } from "solid-js/web";
import { VisXYContainer, VisArea, VisLine, VisAxis, VisCrosshair, VisTooltip } from "@unovis/solid";
import { CurveType, Line } from "@unovis/ts";
import { ChevronDown } from "lucide-solid";
import { computeCDF, renderTime, toInt } from "../../lib/utils";
import { ColoredCircle } from "../custom/ColoredCircle";
import { Button } from "../ui/button";
import { Checkbox } from "../ui/checkbox";
import { Label } from "../ui/label";
import { Popover, PopoverTrigger, PopoverContent } from "../ui/popover";
import { MultiLabelSwitch } from "./MultiLabelSwitch";

const trimChartItems = (chart: ChartData, selected: boolean[]): ChartData => {
  const labels = chart.labels.filter((_, idx) => selected[idx]);
  const trimmedChartData = chart.data.map((v) => ({
    ...v,
    values: v.values.filter((_, idx) => selected[idx]),
  }));

  return {
    data: trimmedChartData,
    labels,
  };
};

const x = (_d: any, i: number) => i;

export function FullHistogram(props: SimulationResultProps) {
  const [isAverage, setIsAverage] = createSignal(false);
  const [isCDF, setIsCDF] = createSignal(false);
  const [enabled, setEnabled] = createSignal<boolean[]>([]);

  const histValues = createMemo(() =>
    isAverage() ? props.data.full_histogram.average : props.data.full_histogram.single,
  );

  const names = createMemo(() => histValues().labels);

  createEffect(() => {
    const len = names().length;
    if (enabled().length !== len) {
      setEnabled(Array.from({ length: len }, () => true));
    }
  });

  // TrimChartItems moved to outer scope

  const chartData = createMemo(() => {
    const includedPersons = trimChartItems(histValues(), enabled());
    const activeLabels = names().filter((_, idx) => enabled()[idx]);

    const histData = isCDF() ? computeCDF(includedPersons.data) : includedPersons.data;

    return histData.map((point) => {
      const result: Record<string, any> = { name: point.name };
      activeLabels.forEach((label, index) => {
        result[label] = point.values[index];
      });
      return result;
    });
  });

  const xTicks = (tick: number | Date, i: number) => {
    const point = chartData()[i];
    if (!point) {
      return "";
    }
    const timeVal = toInt(point.name, 0);
    return renderTime(timeVal, props.event === "333fm");
  };

  const activeLabels = createMemo(() => names().filter((_, idx) => enabled()[idx]));

  const tooltipTemplate = (d: any) => {
    const timeRawValue = toInt(d.name, 0);
    const timeDisplayValue = renderTime(timeRawValue, props.event === "333fm");

    const items = activeLabels()
      .map((label) => {
        const val = d[label];
        if (val === undefined) {
          return null;
        }
        if (props.event === "333fm" && timeRawValue % 100 !== 0) {
          return null;
        }
        const nameIdx = names().indexOf(label);
        const color = props.colors[nameIdx];
        return { label, val, color };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);

    const container = document.createElement("div");
    render(
      () => (
        <div class="relative z-50 rounded-md bg-popover p-2 text-sm text-popover-foreground">
          <p class="font-bold text-foreground">{timeDisplayValue}</p>
          <For each={items}>
            {(item) => (
              <div class="flex justify-between">
                <div class="flex items-center">
                  <span
                    class="mr-2 inline-block h-2.5 w-2.5 rounded-full"
                    style={{ "background-color": item.color }}
                  />
                  <span>{item.label}</span>
                </div>
                <span class="ml-4 font-semibold">
                  {item.val >= 0.01 ? `${item.val.toFixed(2)}%` : "<0.01%"}
                </span>
              </div>
            )}
          </For>
        </div>
      ),
      container,
    );

    return container.firstChild as HTMLElement;
  };

  const crosshairY = createMemo(() => activeLabels().map((label) => (d: any) => d[label]));

  const crosshairColor = (_d: any, i: number) => {
    const label = activeLabels()[i];
    if (!label) {
      return "#888888";
    }
    const nameIdx = names().indexOf(label);
    return props.colors[nameIdx] ?? "#888888";
  };

  return (
    <div class="mx-4 mt-2 mb-4">
      <div class="h-[300px]">
        <VisXYContainer data={chartData()} height={300}>
          <svg width="0" height="0">
            <defs>
              <For each={props.colors}>
                {(color) => (
                  <linearGradient
                    id={`grad-full-${color.replace("#", "")}`}
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="0%" stop-color={color} stop-opacity="0.5" />
                    <stop offset="100%" stop-color={color} stop-opacity="0" />
                  </linearGradient>
                )}
              </For>
            </defs>
          </svg>
          <For each={names()}>
            {(label) => {
              const nameIdx = names().indexOf(label);
              const color = props.colors[nameIdx];
              const cleanColor = color.replace("#", "");
              const yValue = (d: any) => (enabled()[nameIdx] ? d[label] : 0);
              return (
                <VisArea
                  x={x}
                  y={yValue}
                  color={`url(#grad-full-${cleanColor})`}
                  curveType={CurveType.MonotoneX}
                />
              );
            }}
          </For>
          <For each={names()}>
            {(label) => {
              const nameIdx = names().indexOf(label);
              const color = props.colors[nameIdx];
              const yValue = (d: any) => (enabled()[nameIdx] ? d[label] : 0);
              return (
                <VisLine
                  x={x}
                  y={yValue}
                  color={color}
                  curveType={CurveType.MonotoneX}
                  attributes={{
                    [Line.selectors.line]: {
                      strokeWidth: 2,
                    },
                  }}
                />
              );
            }}
          </For>
          <VisAxis type="x" tickFormat={xTicks} gridLine={false} domainLine={false} />
          <VisAxis
            type="y"
            tickFormat={(v: number | Date) => `${typeof v === "number" ? v : v.getTime()}%`}
            gridLine={true}
            domainLine={false}
          />
          <VisCrosshair template={tooltipTemplate} x={x} y={crosshairY()} color={crosshairColor} />
          <VisTooltip horizontalShift={15} />
        </VisXYContainer>
      </div>

      <div class="mt-4 flex flex-col gap-4 px-4 md:flex-row md:items-center">
        <MultiLabelSwitch
          left="Single"
          right="Average"
          checked={isAverage()}
          onChange={setIsAverage}
        />
        <MultiLabelSwitch
          left="Probability"
          right="Cumulative"
          checked={isCDF()}
          onChange={setIsCDF}
        />
        <div class="flex grow justify-end">
          <Popover>
            <PopoverTrigger
              as={Button}
              variant="outline"
              class="flex min-w-44 items-center justify-between"
            >
              <span>Competitors</span>
              <ChevronDown class="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </PopoverTrigger>
            <PopoverContent class="max-h-[300px] w-64 overflow-y-auto">
              <ul class="space-y-2">
                <Index each={names()}>
                  {(name, idx) => (
                    <li class="flex items-center">
                      <Checkbox
                        id={`checkbox-${idx}`}
                        checked={enabled()[idx]}
                        onChange={(val: boolean) => {
                          const next = [...enabled()];
                          next[idx] = val;
                          setEnabled(next);
                        }}
                      />
                      <Label
                        for={`checkbox-${idx}`}
                        class="ml-2 flex grow cursor-pointer items-center text-sm font-normal select-none"
                      >
                        <ColoredCircle class="mx-2 shrink-0" color={props.colors[idx]} />
                        <span class="truncate">{name()}</span>
                      </Label>
                    </li>
                  )}
                </Index>
              </ul>
            </PopoverContent>
          </Popover>
        </div>
      </div>
    </div>
  );
}
