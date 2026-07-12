import { ChevronUp } from "lucide-solid";
import { cn } from "../../lib/utils";

interface ChevronProps {
  up: boolean;
  animate?: boolean;
}

export function RotatableChevron(props: ChevronProps) {
  return (
    <ChevronUp
      class={cn(
        "scale-75 duration-[450ms]",
        props.up && "-rotate-180",
        props.animate !== false && "transition-transform",
      )}
    />
  );
}
