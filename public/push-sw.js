/* 서비스 워커에 붙는 알림 처리 (vite-plugin-pwa → workbox importScripts) */
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data && event.data.text() };
  }
  // iOS는 푸시마다 반드시 알림을 띄워야 함 (안 띄우면 권한이 회수될 수 있음)
  event.waitUntil(
    self.registration.showNotification(data.title || '휴식 끝', {
      body: data.body || '다음 세트를 시작하세요.',
      tag: 'rest',
      renotify: true,
      icon: '/pwa-192.png',
      badge: '/favicon-64.png',
      data: { url: '/' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) if ('focus' in c) return c.focus();
      return self.clients.openWindow('/');
    }),
  );
});
