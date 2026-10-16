/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  base: "./",
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "Njangi237 — Recouvrement communautaire",
        short_name: "Njangi237",
        description: "Tontines et cotisations : paiements, tours et rappels WhatsApp",
        lang: "fr",
        start_url: "./#/",
        display: "standalone",
        background_color: "#F6F4EC",
        theme_color: "#0F5C4E",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: { globPatterns: ["**/*.{js,css,html,png}"], navigateFallback: "index.html" },
    }),
  ],
  build: { target: "es2020" },
  test: { environment: "node", include: ["src/**/*.test.{ts,tsx}"] },
});
