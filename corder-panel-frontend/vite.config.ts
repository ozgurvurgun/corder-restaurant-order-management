import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import path from "path"

export default defineConfig({
  plugins: [react()],
  cacheDir: path.resolve(__dirname, ".vite-cache"),
  resolve: {
    dedupe: ["react", "react-dom"],
    alias: { "@": path.resolve(__dirname, "src") },
  },
  server: {
    port: 3001,
  },
})
