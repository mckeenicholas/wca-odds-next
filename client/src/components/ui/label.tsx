import type { JSX } from "solid-js";
import { cn } from "../../lib/utils";

export function Label(props: JSX.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      class={cn(
        "text-sm leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
        props.class,
      )}
      for={props.for}
      {...props}
    >
      {props.children}
    </label>
  );
}
