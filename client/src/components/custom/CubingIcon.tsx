import { eventNames, type SupportedWCAEvent } from "../../lib/types";
import { cn } from "../../lib/utils";

interface CubingIconProps {
  event: SupportedWCAEvent;
  showTooltip?: boolean;
  class?: string;
}

export function CubingIcon(props: CubingIconProps) {
  const eventName = () => eventNames[props.event] || "";

  return (
    <span
      class={cn("icon cubing-icon", `event-${props.event}`, props.class)}
      title={props.showTooltip === false ? undefined : eventName()}
      aria-label={`${eventName()} icon`}
    />
  );
}
