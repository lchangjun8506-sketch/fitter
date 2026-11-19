import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
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
        theme_color: '#111111',
        background_color: '#F2F2F0',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' },
        ],
      },
    }),
  ],
});
