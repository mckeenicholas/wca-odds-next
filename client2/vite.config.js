import { defineConfig } from "vite";
import solid from "vite-plugin-solid";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import devtools from "solid-devtools/vite";
import tailwindcss from "@tailwindcss/vite";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    devtools(),
    tanstackRouter({ target: "solid", autoCodeSplitting: true }),
    solid(),
    tailwindcss(),
  ],
  build: {
    minify: "terser",
  },
});
