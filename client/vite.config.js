import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// In development the console runs on its own port and proxies the API (and the
// Socket.io websocket) to the Express server. In production Express serves the
// built files from client/dist instead.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:8000",
      "/health": "http://localhost:8000",
      "/socket.io": { target: "http://localhost:8000", ws: true },
    },
  },
});
