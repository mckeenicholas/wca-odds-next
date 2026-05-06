<script setup lang="ts">
import { ref, useId } from "vue";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import Chevron from "./RotatableChevron.vue";

const { title = "", id = useId() } = defineProps<{
  title?: string;
  id?: string;
}>();

const open = ref<boolean>(false);
</script>

<template>
  <Collapsible v-model:open="open" class="rounded-md border">
    <CollapsibleTrigger as-child :aria-controls="id">
      <button
        type="button"
        class="flex w-full cursor-pointer flex-row rounded-sm border-none bg-transparent py-2 ps-4 pe-3 text-left text-inherit hover:bg-secondary"
      >
        <div class="grow">
          {{ title }}
        </div>
        <div class="flex flex-col place-content-center">
          <Chevron :up="open" />
        </div>
      </button>
    </CollapsibleTrigger>
    <CollapsibleContent :id="id">
      <slot></slot>
    </CollapsibleContent>
  </Collapsible>
</template>
