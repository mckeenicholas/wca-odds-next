import { cn } from "../../lib/utils";

interface WCALogoProps {
  class?: string;
}

export function WCALogo(props: WCALogoProps) {
  return (
    <>
      <img src="/wca-logo-light.svg" alt="WCA Profile" class={cn(props.class, "dark:hidden")} />
      <img
        src="/wca-logo-dark.svg"
        alt="WCA Profile"
        class={cn(props.class, "hidden dark:block")}
      />
    </>
  );
}
