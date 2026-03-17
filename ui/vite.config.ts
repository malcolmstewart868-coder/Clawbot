import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173, // <– optional but good practice (explicit default)
    proxy: {
      "/api": {
        target: "http://192.168.0.8:3001",
        changeOrigin: true,
        secure: false, // <– helps with self-signed localhost SSL if used later
      },
    },
  },
});
