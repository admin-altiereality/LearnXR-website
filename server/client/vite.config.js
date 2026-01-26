import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react()],
    
    // Base public path when served in production
    base: '/',
    
    // Development server configuration
    server: {
      port: 3000,
      host: true,
      cors: true,
      hmr: {
        overlay: true,
      },
    },

    // Build configuration
    build: {
      outDir: 'dist',
      assetsDir: 'assets',
      sourcemap: true, // Enable sourcemaps for production debugging
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
      // Enable minification but preserve console logs and readable names for debugging
      minify: 'terser',
      terserOptions: {
        compress: {
          drop_console: false,  // Keep console logs for debugging
          drop_debugger: false,   // Keep debugger statements for debugging
          keep_classnames: true, // Preserve class names for better error messages
          keep_fnames: true,      // Preserve function names for better error messages
          passes: 1,              // Reduce passes to avoid aggressive optimization
        },
        mangle: false,            // DISABLE variable name mangling completely for debugging
        format: {
          comments: false,        // Remove comments but keep structure
          beautify: false,        // Don't beautify (keep minified structure)
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
