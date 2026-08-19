import { cn } from "../../lib/utils";

interface SkeletonProps {
  class?: string;
}

export function Skeleton(props: SkeletonProps) {
  return <div class={cn("animate-pulse rounded-md bg-muted", props.class)} />;
}
