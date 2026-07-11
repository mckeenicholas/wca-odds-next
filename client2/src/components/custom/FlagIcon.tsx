import { cn } from "../../lib/utils";
import "flag-icons/css/flag-icons.min.css";

interface FlagIconProps {
  code: string;
  muted?: boolean;
  showTooltip?: boolean;
}

export function FlagIcon(props: FlagIconProps) {
  const regionNames = new Intl.DisplayNames(["en"], { type: "region" });

  const countryName = () => {
    try {
      return regionNames.of(props.code.toUpperCase()) ?? props.code;
    } catch {
      return props.code;
    }
  };

  return (
    <span
      class={cn(`fi shadow-md fi-${props.code.toLowerCase()}`, props.muted && "opacity-50")}
      title={props.showTooltip === false ? undefined : countryName()}
      aria-label={`${countryName()} flag`}
    />
  );
}
