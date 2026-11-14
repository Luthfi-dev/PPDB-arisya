import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
      },
    },
    build: {
      chunkSizeWarningLimit: 500,
      rolldownOptions: {
        output: {
          codeSplitting: {
            groups: [
              {
                name: 'vendor-react',
                test: /\/node_modules\/(react|react-dom|scheduler)\//,
                priority: 30,
              },
              {
                name: 'vendor-jspdf',
                test: /\/node_modules\/(jspdf|jspdf-autotable|fflate|fast-png|iobuffer|pako)\//,
                priority: 26,
              },
              {
                name: 'vendor-html2canvas',
                test: /\/node_modules\/html2canvas\//,
                priority: 26,
              },
              {
                name: 'vendor-pdf-extra',
                test: /\/node_modules\/(canvg|dompurify|rgbcolor|stackblur-canvas|svg-pathdata)\//,
                priority: 25,
              },
              {
                name: 'vendor-qr',
                test: /\/node_modules\/qrcode\//,
                priority: 25,
              },
              {
                name: 'vendor-icons',
                test: /\/node_modules\/lucide-react\//,
                priority: 20,
              },
              {
                name: 'vendor-motion',
                test: /\/node_modules\/(motion|framer-motion)\//,
                priority: 20,
              },
            ],
          },
        },
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
