import path from "path";
import { fileURLToPath } from "url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), viteSingleFile()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  server: {
    host: true, // Expose to network (0.0.0.0)
    port: 5173, // Default port
    strictPort: false, // Use next available port if 5173 is busy
    watch: {
      usePolling: true, // Better for some systems
    },
    hmr: {
      overlay: true, // Show errors as overlay
    },
  },
  preview: {
    host: true, // Also expose preview server to network
    port: 4173,
  },
});
