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
  navigator.serviceWorker.register("sw.js").catch(function () { /* 静默失败，不影响官网 */ });

  function sbHeaders(extra) {
    var h = { "apikey": cfg.anonKey, "Authorization": "Bearer " + cfg.anonKey, "Content-Type": "application/json" };
    if (extra) for (var k in extra) h[k] = extra[k];
    return h;
  }

  /* ---------- 2. 红点角标：轮询未读留言数 ---------- */
  function updateBadge() {
    if (localStorage.getItem(ADMIN_MARK) !== "1") return;
    if (!cfg.url || !cfg.anonKey) return;
    fetch(cfg.url + "/rest/v1/rpc/msg_unread_count", { method: "POST", headers: sbHeaders(), body: "{}" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (n) {
        if (typeof n !== "number" || isNaN(n)) return;
        if (n > 0 && navigator.setAppBadge) navigator.setAppBadge(n).catch(function () {});
        if (n === 0 && navigator.clearAppBadge) navigator.clearAppBadge().catch(function () {});
      })
      .catch(function () {});
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

  /* ---------- 3. Web Push 订阅 ---------- */
  function urlB64ToUint8(b64) {
    var pad = "=".repeat((4 - (b64.length % 4)) % 4);
    var raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
    var out = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return out;
  }

  function subscribePush(reg) {
    var vapid = cfg.vapidPublicKey;
    if (!vapid) return;                                  // 未配置 VAPID 公钥则跳过
    if (!("PushManager" in window)) return;
    if (typeof Notification === "undefined") return;

    var ask = Notification.permission === "default"
      ? Notification.requestPermission()
      : Promise.resolve(Notification.permission);

    ask.then(function (perm) {
      if (perm !== "granted") return;
      reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64ToUint8(vapid) })
        .then(function (sub) {
          var j = sub.toJSON();
          if (!j.endpoint || !j.keys) return;
          return fetch(cfg.url + "/rest/v1/rpc/push_subscribe", {
            method: "POST",
            headers: sbHeaders(),
            body: JSON.stringify({
              p_endpoint: j.endpoint,
              p_p256dh: j.keys.p256dh,
              p_auth: j.keys.auth,
              p_ua: navigator.userAgent.slice(0, 300)
            })
          });
        })
        .then(function () { updateBadge(); })
        .catch(function () {});
    }).catch(function () {});
  }

  /* ---------- 4. 供 admin.html 调用的开关 ---------- */
  window.ZTPush = {
    /* 管理员登录成功后调用：开启红点轮询 + 订阅推送 */
    adminOnline: function () {
      localStorage.setItem(ADMIN_MARK, "1");
      startPolling();
      navigator.serviceWorker.ready.then(subscribePush).catch(function () {});
    },
    /* 退出登录时调用：清红点、停止轮询（订阅保留，服务器仍会推送，方便在桌面收到新留言提醒） */
    adminOffline: function () {
      localStorage.removeItem(ADMIN_MARK);
      stopPolling();
    }
  };

  /* 页面加载时若已有管理员标记（例如从桌面图标打开官网），直接开始轮询 */
  if (localStorage.getItem(ADMIN_MARK) === "1") startPolling();
})();
