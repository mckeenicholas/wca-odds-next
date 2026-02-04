<script setup lang="ts">
import { AreaChart } from "@/components/ui/chart-area";
import { ChartData, SupportedWCAEvent } from "@/lib/types";
import { computeCDF, createFMCTooltip, renderTime } from "@/lib/utils";
import { computed, ref } from "vue";
import MultiLabelSwitch from "./MultiLabelSwitch.vue";

const { data, color, event } = defineProps<{
  data: ChartData;
  color: string;
  event: SupportedWCAEvent;
}>();

const histogramTooltip = createFMCTooltip(event);
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
  let timeVal = parseInt(histData.value[value as number].name as string);
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
      :custom-tooltip="histogramTooltip"
      showXAxis
      :yFormatter="(value) => `${value}%`"
      :xFormatter
    />
    <MultiLabelSwitch left="Probability" right="Cumulative" v-model="isCDF" />
  </div>
</template>
