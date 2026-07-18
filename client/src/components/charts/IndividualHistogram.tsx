import type { ChartData, SupportedWCAEvent } from "../../lib/types";
import { createSignal, createMemo, For, createUniqueId } from "solid-js";
import { VisXYContainer, VisArea, VisLine, VisAxis, VisCrosshair, VisTooltip } from "@unovis/solid";
import { CurveType, Line } from "@unovis/ts";
import { computeCDF, renderTime, toInt } from "../../lib/utils";
import { MultiLabelSwitch } from "./MultiLabelSwitch";

interface IndividualHistogramProps {
  data: ChartData;
  color: string;
  event: SupportedWCAEvent;
}

interface IndividualHistogramDataPoint {
  name: string;
  single?: number;
  average?: number;
  [key: string]: string | number | undefined;
}

const x = (_d: unknown, i: number) => i;

export function IndividualHistogram(props: IndividualHistogramProps) {
  const [isCDF, setIsCDF] = createSignal(false);
  const chartId = createUniqueId();
  const singleGradientId = `grad-single-${chartId}`;
  const avgGradientId = `grad-avg-${chartId}`;

  const histData = createMemo(() => {
    const chartValues = isCDF() ? computeCDF(props.data.data) : props.data.data;
    return chartValues.map((point) => {
      const result: IndividualHistogramDataPoint = { name: point.name };
      props.data.labels.forEach((label, index) => {
        result[label] = point.values[index];
      });
      return result;
    });
  });

  const xTicks = (tick: number | Date, i: number) => {
    const point = histData()[i];
    if (!point) {
      return "";
    }
    const timeVal = toInt(point.name, 0);
    return renderTime(timeVal, props.event === "333fm");
  };

  const categories = ["single", "average"];
  const colors = () => [props.color, `${props.color}88`];

  const crosshairY = [
    (d: IndividualHistogramDataPoint) => d.single ?? 0,
    (d: IndividualHistogramDataPoint) => d.average ?? 0,
  ];

  const crosshairColor = (_d: unknown, i: number) => (i === 0 ? props.color : `${props.color}88`);

  const tooltipTemplate = (d: IndividualHistogramDataPoint) => {
    const timeRawValue = toInt(d.name, 0);
    const timeDisplayValue = renderTime(timeRawValue, props.event === "333fm");

    const items = categories
      .map((category, idx) => {
        const val = d[category] as number;
        if (val === undefined) {
          return null;
        }
        if (props.event === "333fm" && category === "single" && timeRawValue % 100 !== 0) {
          return null;
        }
        return { category, val, color: colors()[idx] };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);

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
                <span>{item.category}</span>
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

  return (
    <div class="mx-4 mt-2 mb-4">
      <div class="h-[240px]">
        <VisXYContainer data={histData()} height={240}>
          <svg width="0" height="0">
            <defs>
              <linearGradient id={singleGradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color={props.color} stop-opacity="0.6" />
                <stop offset="100%" stop-color={props.color} stop-opacity="0" />
              </linearGradient>
              <linearGradient id={avgGradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color={props.color} stop-opacity="0.3" />
                <stop offset="100%" stop-color={props.color} stop-opacity="0" />
              </linearGradient>
            </defs>
          </svg>
          <VisArea
            x={x}
            y={(d: IndividualHistogramDataPoint) => d.single ?? 0}
            color={`url(#${singleGradientId})`}
            curveType={CurveType.MonotoneX}
          />
          <VisArea
            x={x}
            y={(d: IndividualHistogramDataPoint) => d.average ?? 0}
            color={`url(#${avgGradientId})`}
            curveType={CurveType.MonotoneX}
          />
          <VisLine
            x={x}
            y={(d: IndividualHistogramDataPoint) => d.single ?? 0}
            color={props.color}
            curveType={CurveType.MonotoneX}
            attributes={{
              [Line.selectors.line]: {
                strokeWidth: 2,
              },
            }}
          />
          <VisLine
            x={x}
            y={(d: IndividualHistogramDataPoint) => d.average ?? 0}
            color={`${props.color}88`}
            curveType={CurveType.MonotoneX}
            attributes={{
              [Line.selectors.line]: {
                strokeWidth: 2,
              },
            }}
          />
          <VisAxis type="x" tickFormat={xTicks} gridLine={false} domainLine={false} />
          <VisAxis
            type="y"
            tickFormat={(v: number | Date) => `${typeof v === "number" ? v : v.getTime()}%`}
            gridLine={true}
            domainLine={false}
          />
          <VisCrosshair template={tooltipTemplate} x={x} y={crosshairY} color={crosshairColor} />
          <VisTooltip horizontalShift={15} />
        </VisXYContainer>
      </div>
      <div class="mt-4 flex justify-start pl-8">
        <MultiLabelSwitch
          left="Probability"
          right="Cumulative"
          checked={isCDF()}
          onChange={setIsCDF}
        />
      </div>
    </div>
  );
}
