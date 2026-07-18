import { createSignal, createEffect, onCleanup } from "solid-js";

export function useDebounce<T>(valueAccessor: () => T, delayMs: number): () => T {
  const [debounced, setDebounced] = createSignal<T>(valueAccessor());

  createEffect(() => {
    const val = valueAccessor();
    const timer = setTimeout(() => {
      setDebounced(() => val);
    }, delayMs);

    onCleanup(() => {
      clearTimeout(timer);
    });
  });

  return debounced;
}
