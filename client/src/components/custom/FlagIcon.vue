<script setup lang="ts">
import { computed } from "vue";
import "flag-icons/css/flag-icons.min.css";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const {
  code,
  muted = false,
  showTooltip = true,
} = defineProps<{
  code: string;
  muted?: boolean;
  showTooltip?: boolean;
}>();

const regionNames = new Intl.DisplayNames(["en"], { type: "region" });

const countryName = computed(() => {
  try {
    return regionNames.of(code) || code;
  } catch {
    return code;
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
