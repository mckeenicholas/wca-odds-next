import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import devtools from "solid-devtools/vite";
import { defineConfig } from "vite";
import solid from "vite-plugin-solid";

export default defineConfig({
  build: {
    minify: "oxc",
  },
  plugins: [
    devtools(),
    tanstackRouter({ autoCodeSplitting: true, target: "solid" }),
    solid(),
    tailwindcss(),
  ],
});
