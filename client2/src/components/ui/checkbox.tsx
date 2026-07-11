import { Checkbox as KCheckbox } from "@kobalte/core/checkbox";
import { Check } from "lucide-solid";
import { cn } from "../../lib/utils";

export function Checkbox(props: any) {
  return (
    <KCheckbox
      class="flex items-center"
      checked={props.checked}
      onChange={props.onChange}
      disabled={props.disabled}
      id={props.id}
      aria-label={props["aria-label"]}
    >
      <KCheckbox.Input />
      <KCheckbox.Control
        class={cn(
          "peer h-4 w-4 shrink-0 rounded-sm border border-primary ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 data-[checked]:bg-primary data-[checked]:text-primary-foreground flex items-center justify-center",
          props.class,
        )}
      >
        <KCheckbox.Indicator class="flex h-full w-full items-center justify-center text-current">
          <Check class="h-4 w-4" />
        </KCheckbox.Indicator>
      </KCheckbox.Control>
    </KCheckbox>
  );
}
