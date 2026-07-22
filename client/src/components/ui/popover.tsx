import { Portal } from "solid-js/web";
import {
  Popover as KPopover,
  type PopoverContentProps as KPopoverContentProps,
} from "@kobalte/core/popover";
import { cn } from "../../lib/utils";

export { Popover, Trigger as PopoverTrigger } from "@kobalte/core/popover";

import { splitProps, type JSX } from "solid-js";

export interface PopoverContentProps extends KPopoverContentProps {
  class?: string;
  style?: string | JSX.CSSProperties;
  children?: JSX.Element;
}

export function PopoverContent(props: PopoverContentProps) {
  const [local, others] = splitProps(props, ["class", "style", "children"]);

  return (
    <Portal>
      <KPopover.Content
        style={
          typeof local.style === "string"
            ? `background-color: var(--popover); ${local.style}`
            : {
                "background-color": "var(--popover)",
                ...local.style,
              }
        }
        class={cn(
          "z-50 overflow-hidden rounded-md border bg-popover p-4 text-popover-foreground shadow-md outline-none data-[closed]:animate-out data-[closed]:fade-out-0 data-[closed]:zoom-out-95 data-[expanded]:animate-in data-[expanded]:fade-in-0 data-[expanded]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
          local.class,
        )}
        {...others}
      >
        {local.children}
      </KPopover.Content>
    </Portal>
  );
}
