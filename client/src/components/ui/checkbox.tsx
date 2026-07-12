import { splitProps, Show } from "solid-js";
import { Checkbox as KCheckbox } from "@kobalte/core/checkbox";
import { Check } from "lucide-solid";
import { cn } from "../../lib/utils";

export function Checkbox(props: any) {
  const [local, others] = splitProps(props, [
    "id",
    "checked",
    "onChange",
    "disabled",
    "class",
    "aria-label",
    "children",
  ]);

  return (
    <KCheckbox
      class="flex items-center"
      checked={local.checked}
      onChange={local.onChange}
      disabled={local.disabled}
      aria-label={local["aria-label"]}
      id={local.id}
      {...others}
    >
      <KCheckbox.Input />
      <KCheckbox.Control
        class={cn(
          "peer flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border border-primary ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 data-[checked]:bg-primary data-[checked]:text-primary-foreground",
          local.class,
        )}
      >
        <KCheckbox.Indicator class="flex h-full w-full items-center justify-center text-current">
          <Check class="h-4 w-4" />
        </KCheckbox.Indicator>
      </KCheckbox.Control>
      <Show when={local.children}>
        <KCheckbox.Label class="flex grow items-center">{local.children}</KCheckbox.Label>
      </Show>
    </KCheckbox>
  );
}
