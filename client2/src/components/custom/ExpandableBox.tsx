import { Collapsible } from "@kobalte/core/collapsible";
import { createSignal } from "solid-js";
import { RotatableChevron } from "./RotatableChevron";
import { cn } from "../../lib/utils";

interface ExpandableBoxProps {
  title?: string;
  id?: string;
  class?: string;
  children?: any;
}

export function ExpandableBox(props: ExpandableBoxProps) {
  const [open, setOpen] = createSignal(false);

  return (
    <Collapsible open={open()} onOpenChange={setOpen} class={cn("rounded-md border", props.class)}>
      <Collapsible.Trigger class="flex w-full cursor-pointer flex-row rounded-sm border-none bg-transparent py-2 ps-4 pe-3 text-left text-inherit hover:bg-secondary outline-none">
        <div class="grow">{props.title}</div>
        <div class="flex flex-col place-content-center">
          <RotatableChevron up={open()} />
        </div>
      </Collapsible.Trigger>
      <Collapsible.Content class="animate-in fade-in-0 duration-100 ease-out overflow-hidden">
        {props.children}
      </Collapsible.Content>
    </Collapsible>
  );
}
