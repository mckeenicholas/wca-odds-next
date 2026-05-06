<script setup lang="ts">
import { computed } from "vue";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { type SupportedWCAEvent, eventNames } from "@/lib/types";

const {
  event,
  showTooltip = true,
  class: className,
} = defineProps<{
  event: SupportedWCAEvent;
  showTooltip?: boolean;
  class?: string;
}>();

const eventName = computed(() => {
  return eventNames[event];
});
</script>

<template>
  <span :class="className">
    <TooltipProvider v-if="showTooltip" :delay-duration="300">
      <Tooltip>
        <TooltipTrigger :aria-label="`${eventName} icon`">
          <span class="icon cubing-icon" :class="`event-${event}`"></span>
        </TooltipTrigger>
        <TooltipContent>
          {{ eventName }}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
    <span v-else :class="`icon cubing-icon event-${event}`"></span>
  </span>
</template>
