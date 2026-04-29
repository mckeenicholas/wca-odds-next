<script setup lang="ts">
import type { DateValue } from "@internationalized/date";
import {
  DateFormatter,
  fromDate,
  getLocalTimeZone,
  today,
} from "@internationalized/date";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { CalendarIcon } from "lucide-vue-next";
import { computed } from "vue";

const props = defineProps<{
  modelValue?: Date;
  message?: string;
  placeholder?: string;
  disabled?: boolean;
  allowFuture?: boolean;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: Date | undefined];
  "update:message": [value: string];
}>();

const df = new DateFormatter("en-US", {
  dateStyle: "long",
});

const date = computed<DateValue>({
  get: () =>
    props.modelValue
      ? fromDate(props.modelValue, getLocalTimeZone())
      : today(getLocalTimeZone()),
  set: (val) => emit("update:modelValue", val?.toDate(getLocalTimeZone())),
});

const maxDate = computed(() => {
  if (props.allowFuture) return undefined;
  return today(getLocalTimeZone());
});
</script>

<template>
  <Popover>
    <PopoverTrigger as-child :disabled="props.disabled ?? false">
      <Button
        variant="outline"
        :class="
          cn(
            'w-60 justify-start text-left font-normal',
            !date && 'text-muted-foreground',
          )
        "
      >
        <CalendarIcon />
        {{
          props.modelValue
            ? df.format(props.modelValue)
            : (placeholder ?? "Pick a date")
        }}
      </Button>
    </PopoverTrigger>
    <PopoverContent class="w-auto p-0" align="start">
      <Calendar
        v-model="date"
        v-model:placeholder="date"
        layout="month-and-year"
        initial-focus
        :max-value="maxDate"
      />
      <div v-if="message !== undefined" class="border-t p-3">
        <input
          :value="message"
          class="placeholder:text-muted-foreground w-full bg-transparent text-sm outline-none"
          placeholder="Add a message..."
          @input="
            emit('update:message', ($event.target as HTMLInputElement).value)
          "
        />
      </div>
    </PopoverContent>
  </Popover>
</template>
