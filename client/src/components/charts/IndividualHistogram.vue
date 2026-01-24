<script setup lang="ts">
import { AreaChart } from "@/components/ui/chart-area";
import { SupportedWCAEvent } from "@/lib/types";
import { createFMCTooltip, renderTime, totalSolves } from "@/lib/utils";
import { computed, ref } from "vue";
import MultiLabelSwitch from "./MultiLabelSwitch.vue";

interface DataPoint {
  time: number;
  single: number;
  average: number;
}

const props = defineProps<{
  histAverage: [number, number][];
  histSingle: [number, number][];
  color: string;
  event: SupportedWCAEvent;
}>();

const histogramTooltip = createFMCTooltip(props.event);

const isCDF = ref<boolean>(false);

const solveCount = computed(() => totalSolves(props.histSingle));
const avgCount = computed(() => totalSolves(props.histAverage));

const padChartData = (data: DataPoint[]): DataPoint[] => {
  if (data.length === 0) return [];

  const startTime = data[0].time;
  const endTime = data[data.length - 1].time;

  const beforePadding = [
    { time: startTime - 20, single: 0, average: 0 },
    { time: startTime - 10, single: 0, average: 0 },
  ];

  const afterPadding = isCDF.value
    ? [
        {
          time: endTime + 10,
          single: data[data.length - 1].single,
          average: data[data.length - 1].average,
        },
        {
          time: endTime + 20,
          single: data[data.length - 1].single,
          average: data[data.length - 1].average,
        },
      ]
    : [
        { time: endTime + 10, single: 0, average: 0 },
        { time: endTime + 20, single: 0, average: 0 },
      ];

  return [...beforePadding, ...data, ...afterPadding];
};

const data = computed(() => {
  const singleMap = Object.fromEntries(props.histSingle);
  const averageMap = Object.fromEntries(props.histAverage);

  const allTimes = [
    ...new Set([
      ...props.histSingle.map(([time]) => time),
      ...props.histAverage.map(([time]) => time),
    ]),
  ].sort((a, b) => a - b);

  const dataFormatted = allTimes.reduce((acc: DataPoint[], time, idx) => {
    const prevTimeSingle = isCDF.value
      ? idx === 0
        ? 0
        : acc[idx - 1].single
      : 0;
    const prevTimeAverage = isCDF.value
      ? idx === 0
        ? 0
        : acc[idx - 1].average
      : 0;

    const singleCount = singleMap[time] || 0;
    const averageCount = averageMap[time] || 0;

    const single = parseFloat(
      (singleCount / (solveCount.value / 100) + prevTimeSingle).toFixed(4),
    );
    const average = parseFloat(
      (averageCount / (avgCount.value / 100) + prevTimeAverage).toFixed(4),
    );

    if (single > 0.0001 || average > 0.0001 || isCDF.value) {
      acc.push({ time, single, average });
    }

    return acc;
  }, []);

  if (dataFormatted.length >= 5) {
    return dataFormatted;
  }

  return padChartData(dataFormatted);
});

const xFormatter = (value: number | Date) => {
  const time = data.value[value as number]?.time;
  if (time === undefined) return "";
  return renderTime(time * 10, props.event === "333fm");
};
</script>

<template>
  <div class="ms-4 -me-6 mt-2 mb-4">
    <AreaChart
      class="-ms-6"
      :data="data"
      index="time"
      :categories="['single', 'average']"
      :colors="[color, `${color}88`]"
      :custom-tooltip="histogramTooltip"
      :showXAxis="true"
      :yFormatter="(value) => `${value}%`"
      :xFormatter
    />
    <MultiLabelSwitch left="Probability" right="Cumulative" v-model="isCDF" />
  </div>
</template>
