import { splitProps, type JSX } from "solid-js";
import {
  Select as KSelect,
  type SelectItemProps as KSelectItemProps,
  type SelectTriggerProps as KSelectTriggerProps,
  type SelectContentProps as KSelectContentProps,
} from "@kobalte/core/select";
import { ChevronDown, Check } from "lucide-solid";
import { cn } from "../../lib/utils";

export interface SelectItemProps extends KSelectItemProps {
  class?: string;
  children?: JSX.Element;
}

export interface SelectTriggerProps extends KSelectTriggerProps {
  class?: string;
  children?: JSX.Element;
}

export interface SelectContentProps extends KSelectContentProps {
  class?: string;
}

export { Select, Value as SelectValue } from "@kobalte/core/select";

export function SelectTrigger(props: SelectTriggerProps) {
  const [local, others] = splitProps(props, ["class", "children"]);
  return (
    <KSelect.Trigger
      class={cn(
        "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50",
        local.class,
      )}
      {...others}
    >
      {local.children}
      <KSelect.Icon>
        <ChevronDown class="h-4 w-4 opacity-50" />
      </KSelect.Icon>
    </KSelect.Trigger>
  );
}

export function SelectContent(props: SelectContentProps) {
  const [local, others] = splitProps(props, ["class"]);
  return (
    <KSelect.Portal>
      <KSelect.Content
        class={cn(
          "relative z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md",
          local.class,
        )}
        {...others}
      >
        <KSelect.Listbox class="p-1 outline-none" />
      </KSelect.Content>
    </KSelect.Portal>
  );
}

export function SelectItem(props: SelectItemProps) {
  const [local, others] = splitProps(props, ["class", "children"]);
  return (
    <KSelect.Item
      class={cn(
        "relative flex w-full cursor-default items-center justify-start rounded-sm py-1.5 pr-2 pl-8 text-sm outline-none select-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[highlighted]:bg-muted data-[highlighted]:text-accent-foreground",
        local.class,
      )}
      {...others}
    >
      <span class="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
        <KSelect.ItemIndicator>
          <Check class="h-4 w-4" />
        </KSelect.ItemIndicator>
      </span>
      <KSelect.ItemLabel class="flex w-full items-center justify-start">
        {local.children}
      </KSelect.ItemLabel>
    </KSelect.Item>
  );
}
