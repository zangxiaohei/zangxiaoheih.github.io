/* ==========================================================================
   中天官网 Service Worker
   - 静态资源缓存（离线也能打开官网外壳）
   - 接收服务器 Web Push → 手机弹通知横幅（iOS/安卓需先添加到主屏幕并允许通知）
   - 通知点击跳转对应页面
   ========================================================================== */

var CACHE = "zt-pwa-v1";
var CORE = [
  "./",
  "index.html",
  "assets/css/style.css",
  "assets/css/chat.css",
  "assets/js/push.js",
  "assets/img/icon-192.png",
  "assets/img/icon-512.png"
];

/* 安装：预缓存核心资源 */
self.addEventListener("install", function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) { return c.addAll(CORE); }).then(function () { return self.skipWaiting(); })
  );
});

/* 激活：清理旧版本缓存 */
self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

/* 请求策略：
   - 页面 HTML：网络优先，断网时回退缓存
   - 静态资源：缓存优先，同时后台更新 */
self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return;
  var url = new URL(req.url);
  if (url.origin !== location.origin) return;           // Supabase 等跨域请求一律不拦截

  var isPage = req.mode === "navigate" || (url.pathname.endsWith(".html") || url.pathname.endsWith("/"));

  if (isPage) {
    e.respondWith(
      fetch(req).then(function (res) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copy); });
        return res;
      }).catch(function () {
        return caches.match(req).then(function (hit) { return hit || caches.match("index.html"); });
      })
    );
    return;
  }

  e.respondWith(
    caches.match(req).then(function (hit) {
      var net = fetch(req).then(function (res) {
        if (res && res.status === 200) {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); });
        }
        return res;
      }).catch(function () { return hit; });
      return hit || net;
    })
  );
});

/* 收到推送：弹系统通知（横幅 / 锁屏 / 通知中心） */
self.addEventListener("push", function (e) {
  var data = {};
  try { data = e.data ? e.data.json() : {}; } catch (err) { data = { title: "中天认证", body: (e.data && e.data.text()) || "您有新的消息" }; }
  var title = data.title || "中天认证 · 新消息";
  var body = data.body || "点击查看详情";
  e.waitUntil(
    self.registration.showNotification(title, {
      body: body,
      icon: "assets/img/icon-192.png",
      badge: "assets/img/icon-192.png",
      tag: data.tag || "zt-notify",
      renotify: true,
      data: { url: data.url || "admin.html" }
    })
  );
});

/* 点击通知：跳到对应页面（优先聚焦已打开的窗口） */
self.addEventListener("notificationclick", function (e) {
  e.notification.close();
  var target = (e.notification.data && e.notification.data.url) || "admin.html";
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (list) {
      for (var i = 0; i < list.length; i++) {
        var c = list[i];
        if ("focus" in c) { c.navigate(target); return c.focus(); }
      }
      return self.clients.openWindow(target);
    })
  );
});
