import { defineConfig } from 'vite';
import { createRequire } from 'node:module';
import { patchRevealLifecycle } from './tooling/reveal-lifecycle';
const require = createRequire(import.meta.url);
const revealSource = require.resolve('reveal.js/js/reveal.js');
export default defineConfig({
  resolve: { alias: [{ find: /^reveal\.js$/, replacement: revealSource }] },
  plugins: [{ name: 'pinned-reveal-lifecycle', enforce: 'pre', transform(code, id) {
    if (id.replaceAll('\\', '/').endsWith('/reveal.js/js/reveal.js')) return patchRevealLifecycle(code);
  } }],
  build: {
  target: 'es2022', outDir: 'build/frontend', emptyOutDir: true,
  lib: { entry: 'src/frontend/index.ts', name: 'HaloRichtextContainers', formats: ['iife'], fileName: () => 'frontend.js', cssFileName: 'frontend' },
} });
