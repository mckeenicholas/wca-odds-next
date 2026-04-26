<script lang="ts" setup>
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { reactiveOmit } from "@vueuse/core";
import { ChevronsRight } from "lucide-vue-next";
import type { CalendarNextProps } from "reka-ui";
import { CalendarNext, useForwardProps } from "reka-ui";
import type { HTMLAttributes } from "vue";

const props = defineProps<
  CalendarNextProps & { class?: HTMLAttributes["class"] }
>();

const delegatedProps = reactiveOmit(props, "class");

const forwardedProps = useForwardProps(delegatedProps);
</script>

<template>
  <CalendarNext
    :class="
      cn(
        buttonVariants({ variant: 'outline' }),
        'h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100',
        props.class,
      )
    "
    v-bind="forwardedProps"
    :next-page="(date) => date.add({ years: 1 })"
  >
    <slot>
      <ChevronsRight class="h-4 w-4" />
    </slot>
  </CalendarNext>
</template>
