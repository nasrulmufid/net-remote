import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

// Tailwind v4 via the Vite plugin. We only build one CSS bundle: public/dist/app.css
export default defineConfig({
  plugins: [tailwindcss()],
  publicDir: false,
  build: {
    outDir: 'public/dist',
    emptyOutDir: true,
    rollupOptions: {
      input: 'public/css/app.css',
      output: { assetFileNames: '[name][extname]' },
    },
  },
});
