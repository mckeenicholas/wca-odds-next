<script setup lang="ts">
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import "flag-icons/css/flag-icons.min.css";
import { computed } from "vue";

const props = withDefaults(
  defineProps<{
    code: string;
    muted?: boolean;
    showTooltip?: boolean;
  }>(),
  {
    muted: false,
    showTooltip: true,
  },
);

const countryName = computed(() => {
  try {
    const regionNames = new Intl.DisplayNames(["en"], { type: "region" });
    return regionNames.of(props.code) || props.code;
  } catch {
    return props.code;
  }
});
</script>

<template>
  <TooltipProvider v-if="showTooltip" :delay-duration="300">
    <Tooltip>
      <TooltipTrigger :aria-label="`${countryName} flag`">
        <span
          :class="[
            `fi shadow-md fi-${code.toLowerCase()}`,
            { 'opacity-50': muted },
          ]"
        >
        </span>
      </TooltipTrigger>
      <TooltipContent>
        {{ countryName }}
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
  <span
    v-else
    :class="[`fi shadow-md fi-${code.toLowerCase()}`, { 'opacity-50': muted }]"
  >
  </span>
</template>
