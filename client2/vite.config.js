import { defineConfig } from "vite";
import solid from "vite-plugin-solid";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import devtools from "solid-devtools/vite";
import tailwindcss from "@tailwindcss/vite";

// https://vitejs.dev/config/
export default defineConfig({
  build: {
    minify: "terser",
  },
  plugins: [
    devtools(),
    tanstackRouter({ autoCodeSplitting: true, target: "solid" }),
    solid(),
    tailwindcss(),
  ],
});
