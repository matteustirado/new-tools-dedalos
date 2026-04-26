self.addEventListener('push', (event) => {
  if (!event.data) return;

  try {
    const data = event.data.json();
    
    const options = {
      body: data.notification.body,
      icon: data.notification.icon || '/BananaIcon-App.png',
      badge: data.notification.badge || '/BananaIcon-App.png',
      vibrate: [200, 100, 200],
      sound: '/sounds/notificacao.mp3',
      data: {
        url: data.notification.data?.url || '/'
      }
    };

    event.waitUntil(
      self.registration.showNotification(data.notification.title, options)
    );
  } catch (error) {
    console.error(error);
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((windowClients) => {
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url === event.notification.data.url && 'focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(event.notification.data.url);
      }
    })
  );
});