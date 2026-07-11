import { Portal } from "solid-js/web";
import { Popover as KPopover } from "@kobalte/core/popover";
import { cn } from "../../lib/utils";

export { Popover, Trigger as PopoverTrigger } from "@kobalte/core/popover";

import { splitProps } from "solid-js";

export function PopoverContent(props: any) {
  const [local, others] = splitProps(props, ["class", "style", "children"]);

  return (
    <Portal>
      <KPopover.Content
        style={{
          "background-color": "var(--popover)",
          ...local.style,
        }}
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
