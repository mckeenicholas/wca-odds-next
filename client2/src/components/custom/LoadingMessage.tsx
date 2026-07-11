import { createSignal, onMount, onCleanup } from "solid-js";
import { cn } from "../../lib/utils";

interface LoadingMessageProps {
  message: string;
  class?: string;
}

export function LoadingMessage(props: LoadingMessageProps) {
  const [dots, setDots] = createSignal("");
  let intervalId: number | undefined;

  const updateDots = () => {
    setDots((d) => (d.length < 3 ? `${d}.` : ""));
  };

  onMount(() => {
    intervalId = window.setInterval(updateDots, 333);
  });

  onCleanup(() => {
    if (intervalId) clearInterval(intervalId);
  });

  return (
    <div class={cn("text-center text-2xl", props.class)}>
      {props.message}
      {dots()}
    </div>
  );
}
