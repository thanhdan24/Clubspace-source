import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
export default defineConfig({
  root: path.resolve("standalone"),
  publicDir: path.resolve("public"),
  plugins: [react()],
  resolve: { alias: { "@": path.resolve(".") } },
  build: { outDir: path.resolve("web-dist"), emptyOutDir: true },
  css: { postcss: path.resolve(".") },
  server: { port: 5173, proxy: { "/api": "http://127.0.0.1:3001" } },
});
