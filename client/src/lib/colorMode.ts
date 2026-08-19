import { createSignal, createEffect, onCleanup } from "solid-js";

export type Theme = "light" | "dark" | "system";

const [theme, setTheme] = createSignal<Theme>((localStorage.getItem("theme") as Theme) || "system");

export function changeTheme(newTheme: Theme) {
  setTheme(newTheme);
  localStorage.setItem("theme", newTheme);
}

export function initTheme() {
  const mediaQuery = globalThis.matchMedia("(prefers-color-scheme: dark)");

  const updateClassList = () => {
    const activeTheme = theme();
    const isDark = activeTheme === "dark" || (activeTheme === "system" && mediaQuery.matches);

    if (isDark) {
      document.documentElement.classList.add("dark");
      document.documentElement.style.colorScheme = "dark";
    } else {
      document.documentElement.classList.remove("dark");
      document.documentElement.style.colorScheme = "light";
    }
  };

  createEffect(() => {
    updateClassList();
  });

  const listener = () => {
    if (theme() === "system") {
      updateClassList();
    }
  };

  mediaQuery.addEventListener("change", listener);
  onCleanup(() => {
    mediaQuery.removeEventListener("change", listener);
  });
}
