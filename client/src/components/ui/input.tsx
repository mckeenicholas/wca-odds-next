import { splitProps } from "solid-js";
import { cn } from "../../lib/utils";

export function Input(props: any) {
  const [local, others] = splitProps(props, ["class", "type", "value", "onInput", "onChange"]);

  return (
    <input
      type={local.type ?? "text"}
      value={local.value ?? ""}
      onInput={(e) => {
        local.onInput?.(e.currentTarget.value);
      }}
      onChange={(e) => {
        local.onChange?.(e.currentTarget.value);
      }}
      class={cn(
        "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
        local.class,
      )}
      {...others}
    />
  );
}
