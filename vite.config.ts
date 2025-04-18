import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import themePlugin from "@replit/vite-plugin-shadcn-theme-json";
import path, { dirname } from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
export default defineConfig({
  plugins: [react(), runtimeErrorOverlay(), themePlugin()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "client", "src"),
      "@shared": path.resolve(__dirname, "shared"),
    },
  },
  root: path.resolve(__dirname, "client"),
  build: {
    outDir: path.resolve(__dirname, "dist/public"),
    emptyOutDir: true,
  },
  base: '',
  server: {
    port: 3001, // Client will run on port 3001
    proxy: {
      '/api': {
        // target: 'http://ec2-13-60-196-19.eu-north-1.compute.amazonaws.com:3000', // API server on EC2
        target: 'https://agent-backend-typescript.onrender.com:3000',
        changeOrigin: true,
        secure: false,
      },
      '/ws': {
        // target: 'ws://ec2-13-60-196-19.eu-north-1.compute.amazonaws.com:3000',
      target: 'https://agent-backend-typescript.onrender.com:3000',
        ws: true,
      }
    }
  }
});
