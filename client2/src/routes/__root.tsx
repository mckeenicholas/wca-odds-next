import { Show } from "solid-js";
import { Outlet, createRootRoute, useLocation } from "@tanstack/solid-router";
import { TanStackRouterDevtools } from "@tanstack/solid-router-devtools";
import { QueryClient, QueryClientProvider } from "@tanstack/solid-query";
import { BackButton } from "../components/custom/BackButton";
import { ColorModeSwitcher } from "../components/custom/ColorModeSwitcher";
import { initTheme } from "../lib/colorMode";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: false,
    },
  },
});

export const Route = createRootRoute({
  component: RootComponent,
  notFoundComponent: () => (
    <div class="flex flex-col items-center justify-center p-8 text-center">
      <p class="text-lg font-semibold text-destructive">404 - Page Not Found</p>
      <p class="mt-2 text-sm text-muted-foreground">The page you are looking for does not exist.</p>
      <a href="/" class="mt-4 underline hover:text-primary">
        Start Over
      </a>
    </div>
  ),
});

function RootComponent() {
  // Initialize theme tracking (light/dark/system mode)
  initTheme();

  const location = useLocation();
  const versionNum = "1.2.0";

  return (
    <QueryClientProvider client={queryClient}>
      <Show when={location().pathname !== "/"}>
        <BackButton />
      </Show>
      <div class="flex min-h-screen flex-col">
        <main class="grow">
          <ColorModeSwitcher />
          <Outlet />
        </main>
        <footer class="flex h-10 items-center justify-end px-4 text-sm font-semibold text-muted-foreground">
          <span class="mr-3">
            This website is not affiliated with or endorsed by the{" "}
            <a
              class="underline hover:text-gray-300"
              href="https://www.worldcubeassociation.org/"
              target="_blank"
              rel="noopener noreferrer"
            >
              World Cube Association
            </a>
          </span>
          <span class="mr-3">
            Made by{" "}
            <a
              class="underline hover:text-gray-300"
              href="https://nmckee.org"
              target="_blank"
              rel="noopener noreferrer"
            >
              Nicholas McKee
            </a>
          </span>
          <a
            href="https://github.com/mckeenicholas/wca-odds-next"
            target="_blank"
            rel="noopener noreferrer"
            class="mr-3 hover:text-gray-300"
            aria-label="GitHub Repository"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="h-4 w-4"
            >
              <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.2 1.85v4" />
              <path d="M9 18c-4.51 2-5-2-7-2" />
            </svg>
          </a>
          <span>v{versionNum}</span>
        </footer>
      </div>
      <TanStackRouterDevtools position="bottom-right" />
    </QueryClientProvider>
  );
}
