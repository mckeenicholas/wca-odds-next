<script setup lang="ts">
import { ChartCrosshair } from "@/components/ui/chart";
import {
  ChartTooltipProps,
  HistoryChartMetric,
  HistoryPoint,
} from "@/lib/types";
import {
  Area,
  Axis,
  type BulletLegendItemInterface,
  CurveType,
  Line,
} from "@unovis/ts";
import { VisArea, VisAxis, VisLine, VisXYContainer } from "@unovis/vue";
import { useMounted } from "@vueuse/core";
import { useId } from "radix-vue";
import { computed, h, ref, watchEffect } from "vue";
import HistoryTooltip from "./HistoryTooltip.vue";

const STACKED_OPACITY = 0.8;

const props = withDefaults(
  defineProps<{
    history: HistoryPoint[];
    stacked?: boolean;
    filterOpacity?: number;
    showGradient?: boolean;
    metric: HistoryChartMetric;
  }>(),
  {
    stacked: true,
    filterOpacity: 0.2,
    showGradient: true,
  },
);

const rawId = useId();
const chartRef = computed(() => rawId.replace(/:/g, "-"));
const isMounted = useMounted();

const competitorMeta = computed(() => {
  if (!props.history?.length) return [];

  const lastEntry = props.history[props.history.length - 1];

  const meta = lastEntry.competitors.map((c) => {
    let finalVal = 0;
    if (props.metric === "win") finalVal = c.win_chance;
    else if (props.metric === "podium") finalVal = c.pod_chance;
    else if (props.metric === "rank") finalVal = -c.expected_rank;

    return {
      id: c.id,
      name: c.name,
      color: c.color!,
      finalVal,
    };
  });

  if (props.stacked) {
    return meta.sort((a, b) => a.finalVal - b.finalVal);
  }

  return meta;
});

const processedData = computed(() => {
  if (!props.history?.length) return [];

  return props.history.map((point) => {
    const dataPoint: Record<string, number> = {
      date: new Date(point.date).getTime(),
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
      dataPoint[c.name] = val;
    });

    return dataPoint;
  });
});

const yDomain = computed(() => {
  if (props.metric === "rank") {
    const allRanks = processedData.value.flatMap((d) =>
      competitorMeta.value.map((m) => d[m.name]),
    );
    const maxRank = Math.max(...allRanks, 3);
    return [maxRank + 0.5, 1];
  }
  return [0, 100];
});

const yTickFormat = (v: number) => {
  if (props.metric === "rank") return v.toFixed(1);
  return `${Math.round(v)}%`;
};

const x = (d: Record<string, number>) => d.date;

const legendItems = ref<BulletLegendItemInterface[]>([]);
watchEffect(() => {
  legendItems.value = competitorMeta.value.map((meta) => ({
    name: meta.name,
    color: meta.color,
    inactive: false,
  }));
});

const isCategoryActive = (index: number) => !legendItems.value[index]?.inactive;

const yStacked = computed(() => {
  return competitorMeta.value.map((meta, i) => {
    if (!isCategoryActive(i)) return () => 0;
    return (d: Record<string, number>) => d[meta.name];
  });
});

const stackedColorAccessor = computed(() => {
  return (_: unknown, i: number) => competitorMeta.value[i].color;
});

const dateFormatter = (timestamp: number) => {
  return new Date(timestamp).toLocaleDateString(undefined, {
    month: "short",
    year: "numeric",
  });
};

const tooltip = computed(() => {
  const isPercent = props.metric !== "rank";

  return (tooltipProps: ChartTooltipProps) =>
    h(HistoryTooltip, {
      ...tooltipProps,
      percent: isPercent,
    });
});
</script>

<template>
  <div
    class="flex h-100 w-full flex-col items-end"
    style="--vis-text-color: #888888; --vis-axis-grid-color: #e5e7eb"
  >
    <VisXYContainer
      v-if="processedData.length > 0"
      :style="{ height: isMounted ? '100%' : 'auto' }"
      :margin="{ left: 25, right: 20 }"
      :data="processedData"
    >
      <svg width="0" height="0">
        <defs>
          <linearGradient
            v-for="(comp, i) in competitorMeta"
            :id="`${chartRef}-color-${i}`"
            :key="comp.id"
            x1="0"
            y1="0"
            x2="0"
            y2="1"
          >
            <stop
              offset="5%"
              :stop-color="comp.color"
              :stop-opacity="showGradient ? 0.4 : 0"
            />
            <stop offset="95%" :stop-color="comp.color" stop-opacity="0" />
          </linearGradient>
        </defs>
      </svg>

      <ChartCrosshair
        :colors="competitorMeta.map((c) => c.color)"
        :items="legendItems"
        index="date"
        :custom-tooltip="tooltip"
      />

      <VisArea
        v-if="stacked && metric !== 'rank'"
        :x="x"
        :y="yStacked"
        :color="stackedColorAccessor"
        :curve-type="CurveType.Basis"
        :opacity="STACKED_OPACITY"
        :attributes="{
          [Area.selectors.area]: (_d: unknown, i: number) => ({
            fill: `url(#${chartRef}-color-${i})`,
          }),
        }"
      />

      <template v-else>
        <template v-for="(comp, i) in competitorMeta" :key="comp.id">
          <VisArea
            :x="x"
            :y="(d: Record<string, number>) => d[comp.name]"
            color="auto"
            :curve-type="CurveType.Basis"
            :attributes="{
              [Area.selectors.area]: {
                fill: `url(#${chartRef}-color-${i})`,
              },
            }"
            :opacity="isCategoryActive(i) ? 1 : filterOpacity"
          />
          <VisLine
            :x="x"
            :y="(d: Record<string, number>) => d[comp.name]"
            :color="comp.color"
            :curve-type="CurveType.Basis"
            :attributes="{
              [Line.selectors.line]: {
                opacity: isCategoryActive(i) ? 1 : filterOpacity,
                strokeWidth: 2,
              },
            }"
          />
        </template>
      </template>

      <VisAxis
        type="x"
        :tick-format="dateFormatter"
        :grid-line="false"
        :tick-line="false"
        tick-text-color="var(--vis-text-color)"
        :num-ticks="6"
      />

      <VisAxis
        type="y"
        :tick-line="false"
        :domain-line="false"
        :grid-line="true"
        :domain="yDomain"
        :attributes="{
          [Axis.selectors.grid]: {
            class: 'text-muted',
            stroke: 'var(--vis-axis-grid-color)',
          },
        }"
        tick-text-color="var(--vis-text-color)"
        :tick-format="yTickFormat"
      />
    </VisXYContainer>

    <div
      v-else
      class="text-muted-foreground flex h-full w-full items-center justify-center text-sm"
    >
      No data available
    </div>
  </div>
</template>
