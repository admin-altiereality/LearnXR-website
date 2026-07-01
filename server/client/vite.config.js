import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, process.cwd(), '');

  return {
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
    
    // Base public path when served in production
    base: '/',
    
    // Development server configuration
    server: {
      port: 3000,
      host: true,
      cors: true,
      clearScreen: false, // Keep previous output so errors are visible
      hmr: {
        overlay: true, // Show error overlay in browser
      },
    },

    // Make Vite's own logs visible (errors, warnings)
    logLevel: 'info',

    // Build configuration
    build: {
      outDir: 'dist',
      assetsDir: 'assets',
      sourcemap: mode !== 'production', // Disable in prod to avoid exposing source
      // Use content hash for cache busting (Date.now() per chunk breaks Rollup and can hang the build)
      rollupOptions: {
        output: {
          // manualChunks disabled: large app + custom vendor/three split can stall Rollup for a long time
          chunkFileNames: 'assets/[name]-[hash].js',
          entryFileNames: 'assets/[name]-[hash].js',
          assetFileNames: 'assets/[name]-[hash][extname]',
        },
      },
      // Optimize chunk size warnings
      chunkSizeWarningLimit: 1000,
      // Skip minify with VITE_SKIP_MINIFY=1; reportCompressedSize=false speeds Rollup’s final pass
      reportCompressedSize: false,
      minify: process.env.VITE_SKIP_MINIFY === '1' ? false : 'esbuild',
    },

    // Resolve configuration
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },

    // CSS configuration
    css: {
      modules: {
        localsConvention: 'camelCase',
      },
      postcss: './postcss.config.js',
    },

    // Preview configuration
    preview: {
      port: 5173,
      host: 'localhost',
      strictPort: true,
    },

    // Optimize deps
    optimizeDeps: {
      include: ['react', 'react-dom', 'react-router-dom', 'three'],
      exclude: ['@blockadelabs/sdk'],
    },
  };
});
