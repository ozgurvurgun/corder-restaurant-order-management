import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import path from "path"

export default defineConfig({
  plugins: [react()],
  cacheDir: path.resolve(__dirname, ".vite-cache"),
  optimizeDeps: {
    include: [
      "react",
      "react-dom",
      "react-dom/client",
      "react/jsx-runtime",
      "lucide-react",
      "recharts",
      "socket.io-client",
      "clsx",
      "tailwind-merge",
    ],
  },
  resolve: {
    dedupe: ["react", "react-dom"],
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  server: {
    port: 3004,
  },
})
