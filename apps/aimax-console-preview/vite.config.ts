import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// 라이브 모드 개발·검증 시 /api 를 넘길 대상.
// 로컬 검증은 로컬 server.js(기본), 배포본은 같은 오리진이라 프록시가 필요 없습니다.
const API_PROXY_TARGET = process.env.AIMAX_API_PROXY || "http://127.0.0.1:18899";

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    port: 4175,
    strictPort: true,
    proxy: {
      "/api": {
        target: API_PROXY_TARGET,
        changeOrigin: true,
      },
    },
  },
  preview: {
    host: "127.0.0.1",
    port: 4176,
    strictPort: true,
    proxy: {
      "/api": {
        target: API_PROXY_TARGET,
        changeOrigin: true,
      },
    },
  },
  // 라이브 빌드는 /app2 경로에 올라가므로 자산 경로 기준을 분리합니다.
  base: process.env.VITE_CONSOLE_MODE === "live" ? "/app2/" : "/",
  build: {
    outDir: process.env.VITE_CONSOLE_MODE === "live" ? "dist-live" : "dist",
    sourcemap: true,
  },
}));
