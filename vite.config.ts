import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' keeps every URL relative, so the build works from any GitHub Pages
// sub-path, from a file server, and inside the Android (Capacitor) wrapper.
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: 'dist',
    sourcemap: false,
    target: ['chrome87', 'edge88', 'firefox78', 'safari14'],
    chunkSizeWarningLimit: 1200,
  },
});
