import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { readFileSync } from 'node:fs';
import type { Plugin } from 'vite';

/**
 * 인바디 글자 인식(OCR) 파일을 외부 CDN 대신 우리 사이트 /ocr/ 에서 제공.
 * - 사진이 외부로 나가지 않고, 한 번 받으면 폰에 캐시됨
 */
const OCR_FILES: Record<string, string> = {
  'ocr/worker.min.js': 'node_modules/tesseract.js/dist/worker.min.js',
  'ocr/tesseract-core-simd-lstm.wasm.js': 'node_modules/tesseract.js-core/tesseract-core-simd-lstm.wasm.js',
  'ocr/tesseract-core-lstm.wasm.js': 'node_modules/tesseract.js-core/tesseract-core-lstm.wasm.js',
  'ocr/lang/kor.traineddata.gz': 'node_modules/@tesseract.js-data/kor/4.0.0_best_int/kor.traineddata.gz',
  'ocr/lang/eng.traineddata.gz': 'node_modules/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz',
};
function ocrAssets(): Plugin {
  return {
    name: 'fitter-ocr-assets',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const key = req.url?.split('?')[0].replace(/^\//, '') ?? '';
        const src = OCR_FILES[key];
        if (!src) return next();
        res.setHeader('Content-Type', key.endsWith('.gz') ? 'application/octet-stream' : 'text/javascript');
        res.end(readFileSync(src));
      });
    },
    generateBundle() {
      for (const [fileName, src] of Object.entries(OCR_FILES)) {
        this.emitFile({ type: 'asset', fileName, source: readFileSync(src) });
      }
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    ocrAssets(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['apple-touch-icon.png', 'favicon-64.png'],
      workbox: {
        // OCR 파일(수 MB)은 미리 받지 않고, 처음 인바디를 올릴 때 받아서 캐시
        globIgnores: ['ocr/**'],
        // 휴식 끝 알림(푸시) 받기
        importScripts: ['push-sw.js'],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/ocr/'),
            handler: 'CacheFirst',
            options: { cacheName: 'ocr', expiration: { maxEntries: 10 } },
          },
          {
            urlPattern: ({ request }) => request.destination === 'font',
            handler: 'CacheFirst',
            options: { cacheName: 'fonts', expiration: { maxEntries: 200 } },
          },
        ],
      },
      manifest: {
        name: 'FITTER - 점진적 과부하 운동일지',
        short_name: 'FITTER',
        description: '헬린이를 위한 점진적 과부하 운동일지',
        theme_color: '#F4F4F4',
        background_color: '#F4F4F4',
        id: '/',
        lang: 'ko',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
});
