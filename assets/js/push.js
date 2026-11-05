/* ==========================================================================
   桌面提醒（红点角标 + Web Push 通知）
   工作方式：
   1. 所有页面都会注册 Service Worker（PWA 可添加到手机桌面、支持离线打开）
   2. 只有「管理员标记」存在时（即这台设备登录过后台）才会：
      - 轮询未读留言数 → 桌面图标红点数字（navigator.setAppBadge）
      - 请求通知权限并订阅 Web Push → 有新留言时服务器推送通知横幅
   3. 普通访客设备完全不受打扰
   依赖数据库函数：msg_unread_count() / push_subscribe()（见 admin/push-notify.sql）
   ========================================================================== */
(function () {
  "use strict";
  if (!("serviceWorker" in navigator)) return;

  var cfg = window.SUPABASE_CONFIG || {};
  var ADMIN_MARK = "zt_admin_mark";
  var timer = null;

  /* ---------- 1. 注册 Service Worker ---------- */
  var swPath = /\/admin-app\//.test(location.pathname) ? "../sw.js" : "sw.js";
  navigator.serviceWorker.register(swPath).catch(function () { /* 静默失败，不影响官网 */ });

  function sbHeaders(extra) {
    var h = { "apikey": cfg.anonKey, "Authorization": "Bearer " + cfg.anonKey, "Content-Type": "application/json" };
    if (extra) for (var k in extra) h[k] = extra[k];
    return h;
  }

  /* ---------- 2. 红点角标：轮询未读留言数 ---------- */
  function updateBadge() {
    if (localStorage.getItem(ADMIN_MARK) !== "1") return;
    if (!cfg.url || !cfg.anonKey) return;
    /* 后台页面自己算出的"留言+客服"总未读优先，避免这里只用留言数把角标清掉 */
    if (typeof window.__ztUnread === "number") {
      applyBadge(window.__ztUnread);
      return;
    }
    fetch(cfg.url + "/rest/v1/rpc/msg_unread_count", { method: "POST", headers: sbHeaders(), body: "{}" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (n) {
        if (typeof n !== "number" || isNaN(n)) return;
        applyBadge(n);
      })
      .catch(function () {});
  }

  function applyBadge(n) {
    if (n > 0 && navigator.setAppBadge) navigator.setAppBadge(n).catch(function () {});
    if (n === 0 && navigator.clearAppBadge) navigator.clearAppBadge().catch(function () {});
  }

  function startPolling() {
    if (timer) return;
    updateBadge();
    timer = setInterval(updateBadge, 60 * 1000);
    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState === "visible") updateBadge();
    });
  }

  function stopPolling() {
    if (timer) { clearInterval(timer); timer = null; }
    if (navigator.clearAppBadge) navigator.clearAppBadge().catch(function () {});
  }

  /* ---------- 3. Web Push 订阅 ----------
     返回 Promise：
     "ok"           = 本机已订阅 + 服务器已登记（服务器才会给你发推送）
     "browser-only" = 本机已订阅，但登记服务器失败（多为数据库没跑 push-notify.sql）
     false          = 订阅失败（权限/VAPID/环境问题） */
  function urlB64ToUint8(b64) {
    var pad = "=".repeat((4 - (b64.length % 4)) % 4);
    var raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
    var out = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return out;
  }

  /* 把订阅信息登记到数据库（push_subscribe RPC），服务器靠它知道往哪台设备推 */
  function syncSub(sub) {
    var j = sub.toJSON();
    if (!j.endpoint || !j.keys) return Promise.resolve(false);
    return fetch(cfg.url + "/rest/v1/rpc/push_subscribe", {
      method: "POST",
      headers: sbHeaders(),
      body: JSON.stringify({
        p_endpoint: j.endpoint,
        p_p256dh: j.keys.p256dh,
        p_auth: j.keys.auth,
        p_ua: navigator.userAgent.slice(0, 300)
      })
    }).then(function (r) { return r.ok; }).catch(function () { return false; });
  }

  function subscribePush(reg) {
    var vapid = cfg.vapidPublicKey;
    if (!vapid) return Promise.resolve(false);            // 未配置 VAPID 公钥则跳过
    if (!("PushManager" in window)) return Promise.resolve(false);
    if (typeof Notification === "undefined") return Promise.resolve(false);

    var ask = Notification.permission === "default"
      ? Notification.requestPermission()
      : Promise.resolve(Notification.permission);

    return ask.then(function (perm) {
      if (perm !== "granted") return "err:通知权限为 " + perm + "（需在系统设置里允许「中天后台」的通知）";
      return reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64ToUint8(vapid) })
        .then(function (sub) { return syncSub(sub).then(function (srvOk) { return srvOk ? "ok" : "browser-only"; }); })
        .catch(function (e) { return "err:订阅请求失败 " + (e && e.name ? e.name : "") + ": " + (e && e.message ? e.message : e); });
    }).catch(function (e) { return "err:权限询问失败 " + (e && e.message ? e.message : e); });
  }

  /* 幂等订阅：已有订阅就补登记服务器，没有才新建。失败时把真实原因记到 window.__ztPushErr 供自检面板显示 */
  function ensurePushSubscription() {
    var done = function (r) {
      window.__ztPushErr = (typeof r === "string" && r.indexOf("err:") === 0) ? r.slice(4) : null;
      return r;
    };
    if (!("PushManager" in window)) return Promise.resolve(done("err:此浏览器不支持 PushManager"));
    return navigator.serviceWorker.ready.then(function (reg) {
      return reg.pushManager.getSubscription().then(function (existing) {
        if (existing) return syncSub(existing).then(function (srvOk) { return done(srvOk ? "ok" : "browser-only"); });
        return subscribePush(reg).then(done);
      });
    }).catch(function (e) { return done("err:ServiceWorker未就绪 " + (e && e.message ? e.message : e)); });
  }

  /* ---------- 4. 供 admin.html 调用的开关 ---------- */
  window.ZTPush = {
    /* 管理员登录成功后调用：开启红点轮询 + 订阅推送 */
    adminOnline: function () {
      localStorage.setItem(ADMIN_MARK, "1");
      startPolling();
      ensurePushSubscription().then(function () { updateBadge(); }).catch(function () {});
    },
    /* 手动触发订阅（自检面板「立即订阅」按钮用）；返回 "ok" / "browser-only" / false */
    subscribe: ensurePushSubscription,
    /* 退出登录时调用：清红点、停止轮询（订阅保留，服务器仍会推送，方便在桌面收到新留言提醒） */
    adminOffline: function () {
      localStorage.removeItem(ADMIN_MARK);
      stopPolling();
    }
  };

  /* 页面加载时若已有管理员标记（例如从桌面图标打开官网），直接开始轮询并补订阅 */
  if (localStorage.getItem(ADMIN_MARK) === "1") {
    startPolling();
    ensurePushSubscription().then(function () { updateBadge(); }).catch(function () {});
  }
})();
