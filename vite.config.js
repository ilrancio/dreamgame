import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    chunkSizeWarningLimit: 1500,
    // i modelli 3D (pochi e piccoli) finiscono dentro il gioco: un file solo da pubblicare
    assetsInlineLimit: (file) => (file.endsWith('.glb') ? true : undefined),
  },
});
