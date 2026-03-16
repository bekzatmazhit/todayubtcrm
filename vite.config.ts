import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    // Слушаем на всех интерфейсах, чтобы можно было открывать по IP
    host: "0.0.0.0",
    port: 8080,
    strictPort: true,
    hmr: {
      // Хост/порт для WebSocket-клиента
      host: "localhost",
      port: 8080,
      overlay: false,
    },
    // Dev-прокси: чтобы фронт обращался к /api без CORS
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
    },
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
