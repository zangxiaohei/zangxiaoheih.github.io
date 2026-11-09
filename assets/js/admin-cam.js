/* ============================================================================
   后台设备 · 被监控端（admin-app 专用）
   ----------------------------------------------------------------------------
   作用：让「监控台」(admin-app/watch.html) 能看到登录后台这台设备的摄像头画面。

   浏览器不允许静默开摄像头，所以流程一定是：
     监控台发指令 → 本页弹授权卡 → 本人点「允许」→ 才开始推流

   指令：zt-cam-hub（只带短设备号，不带画面）
   画面：zt-live-<短设备号>（监控台订阅了才收得到，别的设备看不到本机）

   对外接口（挂 window.AdminCam）：
     init(client, email)  登录成功后调用，连指令频道
     state()              当前摄像头状态，心跳上报用：on / deny / na / null
     onAsk()              心跳返回 ask=true 时调用（监控台点了「请求看画面」）
     snap(reason)         抓一帧存成「登录留影」
   ========================================================================== */
(function () {
  "use strict";
  if (window.AdminCam) return;

  var CAM_KEY = "zt_admin_cam";          /* on 已允许 / deny 已拒绝 / na 无摄像头 */
  var MAX_MS = 20 * 60 * 1000;           /* 单次最长 20 分钟，防止忘了关一直烧流量 */
  var INTERVAL = 900;                    /* 900ms 一帧 ≈ 1.1 fps */
  var THUMB_EVERY = 12000;               /* 推流中每 12 秒顺手更新一次「留影」 */

  var client = null, email = "", devId = "";
  var camState = "", declined = false;   /* declined 只作用于本次会话，不写死 */
  var stream = null, video = null, ch = null, timer = null, hub = null;
  var bar = null, card = null, busy = false, started = false;
  var liveT0 = 0, lastThumb = 0, snapAt = 0;

  function lsGet(k) { try { return localStorage.getItem(k) || ""; } catch (e) { return ""; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

  function ensureId() {
    if (devId) return devId;
    devId = lsGet("zt_dev");
    if (!devId) {
      devId = "adm-" + Math.random().toString(36).slice(2, 10) + "-" + Date.now().toString(36).slice(-4);
      lsSet("zt_dev", devId);
    }
    return devId;
  }
  function shortId() { return String(ensureId()).replace(/-/g, "").slice(0, 12); }

  /* ---------------------------------------------------------------- 状态 */
  function setState(v) {
    if (["on", "deny", "na"].indexOf(v) < 0) return;
    camState = v;
    lsSet(CAM_KEY, v);
    report("");
  }
  function report(cam) {
    if (!client) return;
    try {
      var q = client.rpc("zt_presence_photo", { p_id: ensureId(), p_photo: "", p_cam: cam || camState || "none" });
      if (q && q.catch) q.catch(function () {});
    } catch (e) {}
  }

  /* ---------------------------------------------------------------- 抓帧 */
  function grab(v, w, q) {
    if (!v || !v.videoWidth) return null;
    var h = Math.max(1, Math.round(w * v.videoHeight / v.videoWidth));
    var c = grab._c || (grab._c = document.createElement("canvas"));
    c.width = w; c.height = h;
    var g = c.getContext("2d");
    if (!g) return null;
    try { g.drawImage(v, 0, 0, w, h); } catch (e) { return null; }
    return c.toDataURL("image/jpeg", q);
  }

  function upload(big, small) {
    if (!client || !big) return;
    try {
      var q = client.rpc("zt_presence_photo", {
        p_id: ensureId(),
        p_photo: big,
        p_cam: "on",
        p_thumb: small || null
      });
      if (q && q.catch) q.catch(function () {});
    } catch (e) {}
  }

  /* 抓一帧当「登录留影」：监控台列表里就能看到是谁在用这台设备 */
  function snap(reason) {
    if (!client) return;
    if (Date.now() - snapAt < 8000) return;      /* 防抖：连续调用只留一次 */
    if (video && video.videoWidth) {
      snapAt = Date.now();
      upload(grab(video, 480, 0.55), grab(video, 96, 0.5));
      return;
    }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return;
    snapAt = Date.now();
    navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
      audio: false
    }).then(function (s) {
      var v = document.createElement("video");
      v.muted = true; v.setAttribute("muted", ""); v.setAttribute("playsinline", "");
      v.style.cssText = "position:fixed;left:-9999px;top:0;width:2px;height:2px;pointer-events:none";
      v.srcObject = s;
      document.body.appendChild(v);
      v.play().catch(function () {}).then(function () {
        return new Promise(function (done) {
          var n = 0;
          (function wait() {
            if (v.videoWidth > 0) return done(true);
            if (++n > 50) return done(false);
            setTimeout(wait, 100);
          })();
        });
      }).then(function (ok) {
        if (ok) {
          setState("on");
          upload(grab(v, 480, 0.55), grab(v, 96, 0.5));
        }
        try { s.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {}
        if (v.parentNode) v.parentNode.removeChild(v);
      }).catch(function () {
        try { s.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {}
        if (v.parentNode) v.parentNode.removeChild(v);
      });
    }).catch(function () {});
  }

  /* ---------------------------------------------------------------- 提示条 */
  function liveBar(on) {
    if (!on) {
      if (!bar) return;
      var b = bar; bar = null;
      b.classList.remove("on");
      setTimeout(function () { if (b.parentNode) b.parentNode.removeChild(b); }, 260);
      return;
    }
    if (bar) return;
    var box = document.createElement("div");
    box.className = "ac-bar";
    box.innerHTML = '<span class="ac-rec"></span>' +
      '<span class="ac-t">监控台正在查看本机画面</span>' +
      '<button type="button">停止</button>';
    box.querySelector("button").addEventListener("click", function () {
      declined = true;
      stop(true);
    });
    document.body.appendChild(box);
    bar = box;
    requestAnimationFrame(function () { box.classList.add("on"); });
  }

  /* ---------------------------------------------------------------- 授权卡 */
  function askCard(reason) {
    if (card || busy || document.hidden) return;
    if (card) return;
    card = document.createElement("div");
    card.className = "ac-ask";
    card.innerHTML =
      '<button class="ac-x" type="button" aria-label="关闭">✕</button>' +
      '<div class="ac-hd"><span class="ac-ic">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M15 10.5V7.2c0-.7-.6-1.2-1.2-1.2H3.2C2.6 6 2 6.5 2 7.2v9.6c0 .7.6 1.2 1.2 1.2h10.6c.6 0 1.2-.5 1.2-1.2v-3.3l6 3.2V7.3l-6 3.2z"/></svg>' +
      '</span><b>监控台想看本机画面</b></div>' +
      '<p>允许后，管理员在监控台能看到这台设备的摄像头画面（约 1 秒 1 帧，不录制、不保存视频）。你随时可以点「停止」，也可以现在拒绝。</p>' +
      '<div class="ac-btns">' +
        '<button class="ac-ok" type="button">允许查看</button>' +
        '<button class="ac-no" type="button">不开</button>' +
      '</div>' +
      '<div class="ac-tip"></div>';
    document.body.appendChild(card);

    function shut() {
      if (card && card.parentNode) card.parentNode.removeChild(card);
      card = null;
    }
    function tip(t) {
      var e = card && card.querySelector(".ac-tip");
      if (e) e.textContent = t;
    }
    card.querySelector(".ac-x").addEventListener("click", function () {
      declined = true; shut();
    });
    card.querySelector(".ac-no").addEventListener("click", function () {
      /* 「不开」只作用于本次会话：不算永久拒绝，监控台再点还会问一次 */
      declined = true;
      shut();
    });
    card.querySelector(".ac-ok").addEventListener("click", function () {
      if (busy) return;
      var b = card.querySelector(".ac-ok");
      if (b) { b.disabled = true; b.textContent = "正在开启…"; }
      start().catch(function (e) {
        var n = (e && e.name) || "";
        tip(n === "NotAllowedError" || n === "SecurityError"
          ? "浏览器把这个站点的摄像头权限拒绝了，到地址栏左边的锁里改成「允许」再试。"
          : "没找到可用的摄像头，或被别的程序占用了。");
        if (b) { b.disabled = false; b.textContent = "允许查看"; }
      });
    });
  }

  /* ---------------------------------------------------------------- 推流 */
  function stop(notify) {
    if (timer) { clearInterval(timer); timer = null; }
    if (stream) {
      try { stream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {}
      stream = null;
    }
    if (video) {
      try { if (video.parentNode) video.parentNode.removeChild(video); } catch (e) {}
      video = null;
    }
    if (ch) {
      if (notify) {
        try { ch.send({ type: "broadcast", event: "bye", payload: { id: shortId() } }); } catch (e) {}
      }
      try { ch.unsubscribe(); } catch (e) {}
      ch = null;
    }
    if (notify && hub) {
      try { hub.send({ type: "broadcast", event: "bye", payload: { id: shortId() } }); } catch (e) {}
    }
    busy = false;
    liveBar(false);
  }

  function push() {
    var v = video;
    if (!v || !ch || !v.videoWidth) return;
    var img = grab(v, 380, 0.48);
    if (!img) return;
    try {
      var p = ch.send({ type: "broadcast", event: "frame", payload: { id: shortId(), img: img, at: Date.now() } });
      if (p && p.catch) p.catch(function () {});
    } catch (e) {}
  }

  function start() {
    if (busy || stream) return Promise.resolve();
    if (!client) return Promise.reject(new Error("no_client"));
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setState("na");
      return Promise.reject(new Error("unsupported"));
    }
    busy = true;

    var c = null;
    try { c = client.channel("zt-live-" + shortId(), { config: { broadcast: { self: false } } }); } catch (e) { c = null; }
    if (!c) { busy = false; return Promise.reject(new Error("no_channel")); }
    ch = c;
    c.subscribe();

    return navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
      audio: false
    }).catch(function (e) {
      if (e && (e.name === "OverconstrainedError" || e.name === "NotFoundError")) {
        return navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      }
      throw e;
    }).then(function (s) {
      stream = s;
      var v = document.createElement("video");
      v.muted = true;
      v.setAttribute("muted", ""); v.setAttribute("playsinline", ""); v.setAttribute("webkit-playsinline", "");
      v.style.cssText = "position:fixed;left:-9999px;top:0;width:320px;height:240px;pointer-events:none";
      v.srcObject = s;
      document.body.appendChild(v);
      video = v;
      return v.play().catch(function () {}).then(function () {
        return new Promise(function (done) {
          var n = 0;
          (function wait() {
            if (v.videoWidth > 0 && v.videoHeight > 0) return done(true);
            if (++n > 60) return done(false);
            setTimeout(wait, 100);
          })();
        });
      });
    }).then(function (ok) {
      if (!ok) throw new Error("no_frame");
      busy = false;
      setState("on");
      liveBar(true);
      liveT0 = Date.now();
      lastThumb = 0;
      var cv = card;
      if (cv && cv.parentNode) cv.parentNode.removeChild(cv);
      card = null;
      push();
      timer = setInterval(function () {
        if (document.hidden) return;
        if (Date.now() - liveT0 > MAX_MS) { stop(true); return; }
        push();
        if (Date.now() - lastThumb > THUMB_EVERY) {
          lastThumb = Date.now();
          upload(grab(video, 480, 0.55), grab(video, 96, 0.5));
        }
      }, INTERVAL);
    }).catch(function (e) {
      busy = false;
      var n = (e && e.name) || "";
      if (n === "NotAllowedError" || n === "SecurityError") setState("deny");
      else if (n === "NotFoundError" || n === "DevicesNotFoundError") setState("na");
      stop(true);
      throw e;
    });
  }

  /* ---------------------------------------------------------------- 指令频道 */
  function startHub() {
    if (hub || !client) return;
    try { hub = client.channel("zt-cam-hub", { config: { broadcast: { self: false } } }); }
    catch (e) { hub = null; return; }

    hub.on("broadcast", { event: "live" }, function (msg) {
      var p = (msg && msg.payload) || {};
      if (String(p.id || "") !== shortId()) return;      /* 不是发给本机的 */
      if (!p.on) { stop(true); return; }
      if (camState === "deny" || declined) return;        /* 明确拒绝过，不再打扰 */
      if (camState === "on") { start().catch(function () {}); return; }
      if (document.hidden) {
        /* 页面在后台 → 等他切回来再问，卡片弹在看不见的地方等于白弹 */
        var once = function () {
          document.removeEventListener("visibilitychange", once);
          if (!document.hidden) askCard();
        };
        document.addEventListener("visibilitychange", once);
        return;
      }
      askCard();
    });

    hub.subscribe(function (st) {
      if (st !== "SUBSCRIBED") return;
      try { hub.send({ type: "broadcast", event: "hi", payload: { id: shortId(), cam: camState || "none" } }); } catch (e) {}
    });
  }

  /* ---------------------------------------------------------------- 样式 */
  function css() {
    if (document.getElementById("ac-css")) return;
    var s = document.createElement("style");
    s.id = "ac-css";
    s.textContent =
      '.ac-ask{position:fixed;z-index:99998;left:50%;transform:translateX(-50%);bottom:calc(18px + env(safe-area-inset-bottom,0px));' +
      'width:min(420px,calc(100vw - 28px));background:#fff;border-radius:16px;padding:16px 16px 14px;' +
      'box-shadow:0 18px 50px rgba(6,32,24,.3);font:15px/1.65 -apple-system,"PingFang SC","Microsoft YaHei",sans-serif;color:#1f3229;' +
      'animation:acIn .26s ease-out both}' +
      '@keyframes acIn{from{opacity:0;transform:translate(-50%,14px)}to{opacity:1;transform:translate(-50%,0)}}' +
      '.ac-ask .ac-x{position:absolute;top:8px;right:8px;width:30px;height:30px;border:0;border-radius:9px;background:#f1f6f3;color:#7c9188;font-size:13px;cursor:pointer}' +
      '.ac-ask .ac-hd{display:flex;align-items:center;gap:9px;padding-right:26px}' +
      '.ac-ask .ac-ic{width:34px;height:34px;flex:0 0 34px;border-radius:10px;background:#eef7f2;color:#0b6e4f;display:grid;place-items:center}' +
      '.ac-ask .ac-ic svg{width:19px;height:19px}' +
      '.ac-ask b{font-size:15.5px}' +
      '.ac-ask p{margin:9px 0 0;font-size:13.4px;color:#4a6156;line-height:1.62}' +
      '.ac-ask .ac-btns{display:flex;gap:9px;margin-top:13px}' +
      '.ac-ask button{font:inherit;cursor:pointer;border-radius:11px;padding:10px 0;flex:1;font-size:14px;font-weight:700;border:0}' +
      '.ac-ask .ac-ok{background:#0b6e4f;color:#fff}' +
      '.ac-ask .ac-ok:disabled{opacity:.7}' +
      '.ac-ask .ac-no{background:#f1f6f3;color:#5d7a6e;font-weight:600}' +
      '.ac-ask .ac-tip{font-size:12px;color:#c0392b;margin-top:8px;line-height:1.5;min-height:0}' +
      '.ac-bar{position:fixed;z-index:99998;left:50%;transform:translate(-50%,14px);opacity:0;bottom:calc(18px + env(safe-area-inset-bottom,0px));' +
      'display:flex;align-items:center;gap:9px;background:#14261f;color:#eafaf3;border-radius:99px;padding:8px 9px 8px 14px;' +
      'box-shadow:0 10px 30px rgba(0,0,0,.3);font:13.5px/1.4 -apple-system,"PingFang SC","Microsoft YaHei",sans-serif;' +
      'transition:opacity .24s,transform .24s;max-width:calc(100vw - 24px)}' +
      '.ac-bar.on{opacity:1;transform:translate(-50%,0)}' +
      '.ac-bar .ac-rec{width:8px;height:8px;border-radius:50%;background:#ff5b5b;flex:0 0 8px;animation:acBp 1.5s ease-out infinite}' +
      '@keyframes acBp{0%{box-shadow:0 0 0 0 rgba(255,91,91,.6)}70%{box-shadow:0 0 0 6px rgba(255,91,91,0)}100%{box-shadow:0 0 0 0 rgba(255,91,91,0)}}' +
      '.ac-bar .ac-t{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
      '.ac-bar button{border:0;border-radius:99px;background:rgba(255,255,255,.16);color:#fff;font:inherit;font-size:12.5px;font-weight:700;padding:5px 12px;cursor:pointer;flex:0 0 auto}';
    document.head.appendChild(s);
  }

  /* ---------------------------------------------------------------- 对外 */
  window.AdminCam = {
    init: function (cli, mail) {
      client = cli || null;
      email = mail || "";
      ensureId();
      camState = lsGet(CAM_KEY);
      if (["on", "deny", "na"].indexOf(camState) < 0) camState = "";
      css();
      startHub();
      /* 第一次用这台设备登录后台：客气地问一次，别偷偷开 */
      if (!camState && !started) {
        started = true;
        setTimeout(function () {
          if (camState || declined || document.hidden) return;
          askCard();
        }, 3000);
      }
    },
    state: function () { return camState || null; },
    onAsk: function () {
      /* 监控台是人工点「请求看画面」，即使之前拒绝过也再问一次（误点浏览器「阻止」可以救回来） */
      if (declined) return;
      if (camState === "on") { start().catch(function () {}); return; }
      if (document.hidden) return;
      askCard();
    },
    snap: snap,
    stop: function () { stop(true); }
  };
})();
