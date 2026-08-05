import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Hosting build: no publicDir copy (avoids iCloud Desktop stalls). */
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'glsl-loader',
      transform(code, id) {
        if (id.endsWith('.glsl')) {
          return `export default ${JSON.stringify(code)}`;
        }
      },
    },
  ],
  base: '/',
  publicDir: false,
  logLevel: 'info',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    reportCompressedSize: false,
    chunkSizeWarningLimit: 1000,
    minify: process.env.VITE_SKIP_MINIFY === '1' ? false : 'esbuild',
    rollupOptions: {
      output: {
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  css: {
    modules: { localsConvention: 'camelCase' },
    postcss: './postcss.config.js',
  },
});
