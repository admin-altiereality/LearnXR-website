import react from '@vitejs/plugin-react';
import path from 'path';
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
      // Add timestamp to force cache busting
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom', 'react-router-dom'],
            three: ['three', '@react-three/fiber', '@react-three/drei'],
          },
          // Add timestamp to chunk names for cache busting
          chunkFileNames: (chunkInfo) => {
            const timestamp = Date.now();
            return `assets/[name]-${timestamp}.[hash].js`;
          },
          entryFileNames: (chunkInfo) => {
            const timestamp = Date.now();
            return `assets/[name]-${timestamp}.[hash].js`;
          },
          assetFileNames: (assetInfo) => {
            const timestamp = Date.now();
            return `assets/[name]-${timestamp}.[hash].[ext]`;
          },
        },
      },
      // Optimize chunk size warnings
      chunkSizeWarningLimit: 1000,
      // Enable minification - keep console.error/console.warn for debugging
      minify: 'terser',
      terserOptions: {
        compress: {
          // Keep console.error and console.warn so errors are visible in production
          pure_funcs: ['console.log', 'console.info', 'console.debug'],
          drop_debugger: true,
          keep_classnames: true,
          keep_fnames: true,
          passes: 1,
        },
        mangle: false,
        format: {
          comments: false,
          beautify: false,
        },
      },
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
