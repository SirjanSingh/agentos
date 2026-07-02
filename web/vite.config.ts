import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 4311,
    proxy: {
      "/api": "http://localhost:4310",
      "/ws": { target: "ws://localhost:4310", ws: true },
    },
  },
});
