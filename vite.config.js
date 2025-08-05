import vitePluginString from 'vite-plugin-string'
import { resolve } from 'path';
import { defineConfig } from 'vite';
import fs from 'fs';

// Get all HTML files in the current directory
const htmlFiles = fs.readdirSync(__dirname).filter(file => file.endsWith('.html'));

// Generate the input object for Rollup
const input = htmlFiles.reduce((acc, file) => {
  const name = file.replace('.html', '');
  acc[name] = resolve(__dirname, file);
  return acc;
}, {});

export default {
  plugins: [
    vitePluginString()
  ],
  publicDir: 'public',
  build: {
    rollupOptions: {
      input,
    },
  },
}