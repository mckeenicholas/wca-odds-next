import { Ref, nextTick, ref, type TemplateRef } from "vue";
import { useRouter } from "vue-router";

export interface NavigationItem {
  id: string | number;
}

export function useListNavigation<T extends NavigationItem>({
  data,
  listContainerRef,
  onSelectPath,
}: {
  data: Ref<T[] | undefined>;
  listContainerRef: Readonly<TemplateRef<HTMLDivElement>>;
  onSelectPath: (item: T) => string;
}) {
  const router = useRouter();
  const selectedResult = ref<number>(-1);

  const resetSelection = () => {
    selectedResult.value = -1;
  };

  const scrollToSelected = () => {
    nextTick(() => {
      if (listContainerRef.value && selectedResult.value !== -1) {
        const olElement = listContainerRef.value.querySelector("ol");
        if (
          olElement &&
          data.value &&
          selectedResult.value >= 0 &&
          selectedResult.value < data.value.length &&
          olElement.children[selectedResult.value]
        ) {
          const selectedItemEl = olElement.children[
            selectedResult.value
          ] as HTMLElement;
          selectedItemEl.scrollIntoView({
            block: "nearest",
            behavior: "smooth",
          });
        }
      }
    });
  };

  const handleKeydown = (event: KeyboardEvent) => {
    if (!data.value || data.value.length === 0) {
      if (event.key === "ArrowUp" || event.key === "ArrowDown") {
        event.preventDefault();
      }
      return;
    }

    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        selectedResult.value =
          selectedResult.value === -1
            ? 0
            : (selectedResult.value + 1) % data.value.length;
        scrollToSelected();
        break;
      case "ArrowUp":
        event.preventDefault();
        selectedResult.value =
          selectedResult.value === -1
            ? data.value.length - 1
            : selectedResult.value === 0
              ? data.value.length - 1
              : selectedResult.value - 1;
        scrollToSelected();
        break;
      case "Enter":
        if (
          selectedResult.value !== -1 &&
          selectedResult.value < data.value.length
        ) {
          event.preventDefault();
          const item = data.value[selectedResult.value];
          router.push(onSelectPath(item));
        }
        break;
      case "Escape":
        event.preventDefault();
        resetSelection();
        break;
    }
  };

  return {
    selectedResult,
    handleKeydown,
    resetSelection,
  };
}
