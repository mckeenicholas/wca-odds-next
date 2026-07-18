import type { ChartData, SimulationResultProps } from "../../lib/types";
import { createSignal, createMemo, For, Index } from "solid-js";
import { VisXYContainer, VisArea, VisLine, VisAxis, VisCrosshair, VisTooltip } from "@unovis/solid";
import { CurveType, Line } from "@unovis/ts";
import { ChevronDown } from "lucide-solid";
import { computeCDF, renderTime, toInt } from "../../lib/utils";
import { ColoredCircle } from "../custom/ColoredCircle";
import { Button } from "../ui/button";
import { Checkbox } from "../ui/checkbox";
import { Popover, PopoverTrigger, PopoverContent } from "../ui/popover";
import { MultiLabelSwitch } from "./MultiLabelSwitch";

const trimChartItems = (chart: ChartData, disabledIndices: Set<number>): ChartData => {
  const selectedIndices = chart.labels.map((_, idx) => !disabledIndices.has(idx));
  const labels = chart.labels.filter((_, idx) => selectedIndices[idx]);
  const trimmedChartData = chart.data.map((v) => ({
    ...v,
    values: v.values.filter((_, idx) => selectedIndices[idx]),
  }));

  return {
    data: trimmedChartData,
    labels,
  };
};

const x = (_d: unknown, i: number) => i;

interface TooltipItem {
  label: string;
  val: number;
  color: string;
}

interface FullHistogramDataPoint {
  name: string;
  [key: string]: string | number;
}

export function FullHistogram(props: SimulationResultProps) {
  const [isAverage, setIsAverage] = createSignal(false);
  const [isCDF, setIsCDF] = createSignal(false);
  const [disabledIndices, setDisabledIndices] = createSignal<Set<number>>(new Set());

  const histValues = createMemo(() =>
    isAverage() ? props.data.full_histogram.average : props.data.full_histogram.single,
  );

  const names = createMemo(() => histValues().labels);

  const activeIndices = createMemo(() =>
    names()
      .map((_, idx) => idx)
      .filter((idx) => !disabledIndices().has(idx)),
  );

  const chartData = createMemo(() => {
    const includedPersons = trimChartItems(histValues(), disabledIndices());
    const currentActiveIndices = activeIndices();

    const histData = isCDF() ? computeCDF(includedPersons.data) : includedPersons.data;

    return histData.map((point) => {
      const result: FullHistogramDataPoint = { name: point.name };
      currentActiveIndices.forEach((nameIdx, index) => {
        result[nameIdx.toString()] = point.values[index];
      });
      return result;
    });
  });

  const xTicks = (_tick: unknown, i: number) => {
    const point = chartData()[i];
    if (!point) {
      return "";
    }
    const timeVal = toInt(point.name, 0);
    return renderTime(timeVal, props.event === "333fm");
  };

  const tooltipTemplate = (d: FullHistogramDataPoint) => {
    const timeRawValue = toInt(d.name, 0);
    const timeDisplayValue = renderTime(timeRawValue, props.event === "333fm");

    const items: TooltipItem[] = activeIndices()
      .map((nameIdx) => {
        const val = d[nameIdx.toString()] as number;
        if (val === undefined) {
          return null;
        }
        if (props.event === "333fm" && timeRawValue % 100 !== 0) {
          return null;
        }
        const label = names()[nameIdx];
        const color = props.colors[nameIdx];
        return { label, val, color };
      })
      .filter((item): item is TooltipItem => item !== null);

    return (
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
    ) as HTMLElement;
  };

  const crosshairY = createMemo(() =>
    activeIndices().map(
      (nameIdx) => (d: FullHistogramDataPoint) => d[nameIdx.toString()] as number,
    ),
  );

  const crosshairColor = (_d: unknown, i: number) => {
    const nameIdx = activeIndices()[i];
    return props.colors[nameIdx] ?? "#888888";
  };

  return (
    <div class="mx-4 mt-2 mb-4">
      <div class="h-75">
        <VisXYContainer data={chartData()} height={300}>
          <svg width="0" height="0">
            <defs>
              <For each={props.colors}>
                {(color, index) => (
                  <linearGradient id={`grad-full-${index()}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color={color} stop-opacity="0.5" />
                    <stop offset="100%" stop-color={color} stop-opacity="0" />
                  </linearGradient>
                )}
              </For>
            </defs>
          </svg>
          <Index each={names()}>
            {(label, nameIdx) => {
              const yValue = (d: Record<string, string | number>) =>
                disabledIndices().has(nameIdx) ? 0 : (d[nameIdx.toString()] as number);
              return (
                <VisArea
                  x={x}
                  y={yValue}
                  color={`url(#grad-full-${nameIdx})`}
                  curveType={CurveType.MonotoneX}
                />
              );
            }}
          </Index>
          <Index each={names()}>
            {(label, nameIdx) => {
              const color = props.colors[nameIdx];
              const yValue = (d: Record<string, string | number>) =>
                disabledIndices().has(nameIdx) ? 0 : (d[nameIdx.toString()] as number);
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
          </Index>
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
        <div class="flex grow">
          <Popover>
            <PopoverTrigger
              as={Button}
              variant="outline"
              class="flex w-full min-w-44 items-center justify-between font-normal"
            >
              <span>Competitors</span>
              <ChevronDown class="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </PopoverTrigger>
            <PopoverContent class="max-h-[300px] w-[var(--kb-popper-anchor-width)] overflow-y-auto">
              <ul class="space-y-2">
                <Index each={names()}>
                  {(name, idx) => (
                    <li class="flex items-center">
                      <Checkbox
                        id={`checkbox-${idx}`}
                        checked={!disabledIndices().has(idx)}
                        onChange={(val: boolean) => {
                          const next = new Set(disabledIndices());
                          if (val) {
                            next.delete(idx);
                          } else {
                            next.add(idx);
                          }
                          setDisabledIndices(next);
                        }}
                        class="cursor-pointer"
                      >
                        <span class="ml-2 flex grow items-center text-sm font-normal select-none">
                          <ColoredCircle class="mx-2 shrink-0" color={props.colors[idx]} />
                          <span class="truncate">{name()}</span>
                        </span>
                      </Checkbox>
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
