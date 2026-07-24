const CACHE = 'peso-budget-v3';
const ASSETS = ['./index.html', './manifest.json', './sortable.min.js'];

self.addEventListener('install', e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e=>{
  e.waitUntil(
    caches.keys().then(keys=>
      Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('push', e=>{
  let data = {};
  try{ data = e.data ? e.data.json() : {}; }catch(err){}
  const title = data.title || 'Peso Budget';
  const body = data.body || "Don't forget to log today's spending!";
  e.waitUntil(self.registration.showNotification(title, {
    body,
    icon: './icon.png',
    tag: 'peso-budget-reminder'
  }));
});

self.addEventListener('notificationclick', e=>{
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({type:'window'}).then(list=>{
      for(const client of list){ if('focus' in client) return client.focus(); }
      if(self.clients.openWindow) return self.clients.openWindow('./');
    })
  );
});

self.addEventListener('fetch', e=>{
  if(e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if(url.origin !== self.location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then(res=>{
        const copy = res.clone();
        caches.open(CACHE).then(c=>c.put(e.request, copy));
        return res;
      })
      .catch(()=> caches.match(e.request))
  );
});
