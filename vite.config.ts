import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    sourcemap: true,
    minify: false,
    lib: {
      entry: 'src/main.ts',
      name: 'XhsShell',
      formats: ['iife'],
      fileName: () => 'xhs-shell.iife.js',
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
  },
});
