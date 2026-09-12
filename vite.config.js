import { defineConfig } from 'vite';

// GitHub Pages serves the site from /<repo-name>/, so assets need that prefix
// in production. Rename this if the repository is named something else.
const REPO = 'game';

// Версия для обхода кэша картинок. У JS-бандла Vite сам вешает хэш в имя, а
// файлы из public/ едут под неизменными именами — после деплоя браузер
// продолжает показывать старую картинку из кэша, пока не истечёт max-age
// (на GitHub Pages 600 с, но Safari держит дольше). Версия приклеивается к
// путям спрайтов запросом ?v= (core/sprites.js).
//
// В CI это короткий SHA коммита: стабильный в пределах одного деплоя и
// меняющийся между ними. Локально — метка времени запуска сборки.
const ASSET_VERSION = (process.env.GITHUB_SHA || '').slice(0, 8) || Date.now().toString(36);

export default defineConfig(({ command }) => ({
  define: {
    __ASSET_VERSION__: JSON.stringify(ASSET_VERSION),
  },
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
