<script setup lang="ts">
import { eventNames, SupportedWCAEvent } from "@/lib/types";
import { computed } from "vue";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const props = withDefaults(
  defineProps<{
    event: SupportedWCAEvent;
    showTooltip?: boolean;
    class?: string;
  }>(),
  {
    showTooltip: true,
  },
);

const eventName = computed(() => {
  return eventNames[props.event];
});
</script>

<template>
  <span :class="props.class">
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
