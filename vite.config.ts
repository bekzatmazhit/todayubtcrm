import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    // Слушаем на всех интерфейсах, чтобы можно было открывать по IP
    host: "0.0.0.0",
    port: Number(process.env.VITE_DEV_PORT || 5173),
    strictPort: false,
    
    // Dev-прокси: чтобы фронт обращался к /api без CORS
    proxy: {
      "/api": {
        target: `http://127.0.0.1:${process.env.VITE_BACKEND_PORT || 3001}`,
        changeOrigin: true,
      },
      "/uploads": {
        target: `http://127.0.0.1:${process.env.VITE_BACKEND_PORT || 3001}`,
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
