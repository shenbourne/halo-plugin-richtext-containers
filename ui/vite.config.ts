import { viteConfig } from '@halo-dev/ui-plugin-bundler-kit/vite';
export default viteConfig({ format: 'iife', targetHaloVersion: '2.27.1', vite: {
  build: { outDir: 'build/dist', emptyOutDir: true }
} });
