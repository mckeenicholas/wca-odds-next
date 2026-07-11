import { Link } from "@tanstack/solid-router";
import { FlagIcon } from "./FlagIcon";
import { WCALogo } from "./WCALogo";
import { cn } from "../../lib/utils";

interface CompetitorLinkProps {
  name: string;
  id: string | null;
  iso2: string | null;
  class?: string;
  event?: string | null;
}

export function CompetitorLink(props: CompetitorLinkProps) {
  const wcaLink = () => {
    if (!props.id) return "#";
    const url = new URL(`https://www.worldcubeassociation.org/persons/${props.id}`);
    if (props.event) {
      url.searchParams.append("event", props.event);
    }
    return url.toString();
  };

  const personalLink = () => {
    const base = `/rankings/personal/${props.id}`;
    if (!props.event) return base;
    const params = new URLSearchParams({ event: props.event });
    return `${base}?${params}`;
  };

  return (
    <div class={cn(props.class, "min-w-0 flex items-center")}>
      {props.iso2 && <FlagIcon code={props.iso2} />}
      <Link
        to={personalLink()}
        onClick={(e) => e.stopPropagation()}
        class="ms-2 min-w-0 truncate hover:underline"
      >
        {props.name}
      </Link>
      {props.id && (
        <a
          href={wcaLink()}
          target="_blank"
          rel="noopener noreferrer"
          class="inline-flex shrink-0 align-[-0.125em]"
        >
          <WCALogo class="ml-2 h-4 w-4" />
        </a>
      )}
    </div>
  );
}
