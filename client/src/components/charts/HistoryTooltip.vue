<script setup lang="ts">
import { formatPercentage } from "@/lib/utils";
import ColoredCircle from "../custom/ColoredCircle.vue";

export interface HistoryTooltipProps {
  title?: string;
  percent?: boolean;
  data: {
    name: string;
    color: string;
    value: string | number;
  }[];
}

const { title, data, percent } = defineProps<HistoryTooltipProps>();

const formatDate = (dateNum: number) => {
  const dateObj = new Date(dateNum);
  return dateObj.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
  });
};

const formatValue = (val: string | number) => {
  const num = typeof val === "string" ? parseFloat(val) : val;

  if (percent) {
    return formatPercentage(num);
  }

  return num.toFixed(2);
};
</script>

<template>
  <div class="rounded-md p-2">
    <p v-if="title" class="border-bottom mb-1 pb-1 font-bold">
      {{ formatDate(parseInt(title)) }}
    </p>
    <div
      v-for="(item, key) in data"
      :key="key"
      class="flex justify-between text-sm"
    >
      <div class="flex items-center">
        <span class="mr-2 h-2.5 w-2.5">
          <ColoredCircle :color="item.color" />
        </span>
        <span>{{ item.name }}</span>
      </div>
      <span class="ml-4 font-semibold">
        {{ formatValue(item.value) }}
      </span>
    </div>
  </div>
</template>
