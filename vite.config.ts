import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['apple-touch-icon.png', 'favicon-64.png'],
      workbox: {
        // 폰트 조각은 처음 쓸 때 받아서 캐시 → 이후 오프라인에서도 동일하게 표시
        runtimeCaching: [
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
        theme_color: '#F2ECDF',
        background_color: '#F2ECDF',
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
