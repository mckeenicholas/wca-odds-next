<script setup lang="ts">
import { computed, ref } from "vue";
import type { ChartData, SupportedWCAEvent } from "@/lib/types";
import HistogramCustomTooltip from "@/components/charts/HistogramCustomTooltip.vue";
import { AreaChart } from "@/components/ui/chart-area";
import { computeCDF, renderTime } from "@/lib/utils";
import MultiLabelSwitch from "./MultiLabelSwitch.vue";

const { data, color, event } = defineProps<{
  data: ChartData;
  color: string;
  event: SupportedWCAEvent;
}>();

const isFmc = event === "333fm";
const isCDF = ref<boolean>(false);

const histData = computed(() => {
  const chartValues = isCDF.value ? computeCDF(data.data) : data.data;
  return chartValues.map((point) => {
    const result: Record<string, string | number> = { name: point.name };

    data.labels.forEach((label, index) => {
      result[label] = point.values[index];
    });

    return result;
  });
});

const xFormatter = (value: number | Date) => {
  const timeVal = parseInt(histData.value[value as number].name as string);
  return renderTime(timeVal, event === "333fm");
};
</script>

<template>
  <div class="ms-4 -me-6 mt-2 mb-4">
    <AreaChart
      class="-ms-6"
      :data="histData"
      index="name"
      :categories="['single', 'average']"
      :colors="[color, `${color}88`]"
      :custom-tooltip="HistogramCustomTooltip"
      :custom-tooltip-props="{ isFmc }"
      showXAxis
      :yFormatter="(value) => `${value}%`"
      :xFormatter
    />
    <MultiLabelSwitch left="Probability" right="Cumulative" v-model="isCDF" />
  </div>
</template>
