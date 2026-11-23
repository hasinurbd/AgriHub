import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    envPrefix: ['VITE_', 'NEXT_PUBLIC_'],
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
      },
    },
    build: {
      rolldownOptions: {
        output: {
          codeSplitting: {
            groups: [
              {
                name: 'vendor-react',
                test: /node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/,
                priority: 30,
              },
              {
                name: 'vendor-dexie',
                test: /node_modules[\\/]dexie[\\/]/,
                priority: 25,
              },
              {
                name: 'vendor-charts',
                test: /node_modules[\\/](chart\.js|react-chartjs-2|@kurkle)[\\/]/,
                priority: 25,
              },
              {
                name: 'vendor-icons',
                test: /node_modules[\\/]lucide-react[\\/]/,
                priority: 20,
              },
              {
                name: 'vendor-pdf',
                test: /node_modules[\\/](jspdf|html2canvas|html-to-image|dompurify|fflate|canvg|stackblur-canvas)[\\/]/,
                priority: 28,
              },
              {
                name: 'vendor-ai',
                test: /node_modules[\\/]@google[\\/]genai[\\/]/,
                priority: 25,
              },
            ],
          },
        },
      },
    },
    server: {
      port: 3000,
      host: '0.0.0.0',
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
