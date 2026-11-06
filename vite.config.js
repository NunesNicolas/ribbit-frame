import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({ base: './', cacheDir: '.vite-cache', plugins: [react()], clearScreen: false, optimizeDeps: { force: true }, server: { strictPort: true } });
