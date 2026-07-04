<script setup lang="ts">
import { computed, ref, watchEffect } from "vue";
import type { ChartData, SimulationResultProps } from "@/lib/types";
import HistogramCustomTooltip from "@/components/charts/HistogramCustomTooltip.vue";
import ColoredCircle from "@/components/custom/ColoredCircle.vue";
import { AreaChart } from "@/components/ui/chart-area";
import Checkbox from "@/components/ui/checkbox/Checkbox.vue";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectTrigger } from "@/components/ui/select";
import { computeCDF, renderTime } from "@/lib/utils";
import MultiLabelSwitch from "./MultiLabelSwitch.vue";

const { data, event, colors } = defineProps<SimulationResultProps>();

const isFmc = event === "333fm";

const isAverage = ref<boolean>(false);
const isCDF = ref<boolean>(false);

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

const histValues = computed(() => {
  return isAverage.value
    ? data.full_histogram.average
    : data.full_histogram.single;
});

const names = computed(() => {
  return histValues.value.labels;
});

const enabled = ref<boolean[]>(
  Array.from({ length: names.value.length }, () => true),
);

watchEffect(() => {
  const len = names.value.length;
  if (enabled.value.length !== len) {
    enabled.value = Array.from({ length: len }, () => true);
  }
});

const chartData = computed(() => {
  const includedPersons = trimChartItems(histValues.value, enabled.value);
  const activeLabels = names.value.filter((_, idx) => enabled.value[idx]);

  const histData = isCDF.value
    ? computeCDF(includedPersons.data)
    : includedPersons.data;

  return histData.map((point) => {
    const result: Record<string, string | number> = { name: point.name };

    activeLabels.forEach((label, index) => {
      result[label] = point.values[index];
    });

    return result;
  });
});

const xFormatter = (value: number | Date) => {
  const timeVal = parseInt(chartData.value[value as number].name as string);
  return renderTime(timeVal, event === "333fm");
};
</script>

<template>
  <div class="ms-4 -me-6 mt-2 mb-4">
    <AreaChart
      class="-ms-6"
      :data="chartData"
      index="name"
      :categories="histValues.labels"
      :colors="colors"
      :showLegend="false"
      :customTooltip="HistogramCustomTooltip"
      :customTooltipProps="{ isFmc }"
      showXAxis
      :yFormatter="(value) => `${value}%`"
      :xFormatter
      showYAxis
    />
    <div class="lg:flex lg:pe-10">
      <MultiLabelSwitch
        class="ms-8"
        left="Single"
        right="Average"
        v-model="isAverage"
      />
      <MultiLabelSwitch
        class="ms-8 mt-2"
        left="Probability"
        right="Cumulative"
        v-model="isCDF"
      />
      <div class="ms-4 flex grow justify-end">
        <Select>
          <SelectTrigger class="mt-2 min-w-36"> Competitors </SelectTrigger>
          <SelectContent>
            <ul>
              <li
                v-for="(name, idx) in names"
                :key="idx"
                class="mx-2 flex grow items-center"
              >
                <Checkbox :id="`checkbox-${idx}`" v-model="enabled[idx]" />
                <Label
                  :for="`checkbox-${idx}`"
                  class="text-md flex items-center font-normal"
                >
                  <ColoredCircle class="mx-2" :color="colors[idx]" />
                  {{ name }}
                </Label>
              </li>
            </ul>
          </SelectContent>
        </Select>
      </div>
    </div>
  </div>
</template>
