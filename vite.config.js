import { defineConfig } from 'vite';

// GitHub Pages serves the site from /<repo-name>/, so assets need that prefix
// in production. Rename this if the repository is named something else.
const REPO = 'tarot-journey';

export default defineConfig(({ command }) => ({
  base: command === 'build' ? `/${REPO}/` : '/',
  build: {
    outDir: 'dist',
    assetsInlineLimit: 0,   // never inline sprites as base64 — they must stay real files
    target: 'es2020',
  },
  server: {
    port: 5173,
  },
}));
