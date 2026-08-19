import { render } from "solid-js/web";
import "solid-devtools";
import { RouterProvider, createRouter } from "@tanstack/solid-router";
import { routeTree } from "./routeTree.gen";
import "./styles.css";

// Set up a Router instance
const router = createRouter({
  defaultPreload: "intent",
  defaultStaleTime: 5000,
  routeTree,
  scrollRestoration: true,
});

// Register things for typesafety
declare module "@tanstack/solid-router" {
  interface Register {
    router: typeof router;
  }
}

const rootElement = document.querySelector("#app")!;

if (!rootElement.innerHTML) {
  render(() => <RouterProvider router={router} />, rootElement);
}
