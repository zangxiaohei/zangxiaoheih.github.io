/* ==========================================================================
   悬浮在线客服 — 双向会话版
   · 访客消息写入 chat_messages（经 chat_visitor_send 函数，匿名安全）
   · 每 6 秒拉取一次客服回复（chat_fetch），历史自动保留
   · 客服在 admin.html 后台回复，访客这里能看到
   · 未配置数据库时自动降级为本地问答演示
   内容配置在 assets/data/site.js 的 chat 段
   ========================================================================== */
(function () {
  "use strict";
  var C = (window.SITE || {}).chat;
  if (!C) return;

  var TEL = (window.SITE.company || {}).phoneRaw || "";
  var ICON_CHAT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a8 8 0 01-8 8H5l-2 2V12a8 8 0 018-8h2a8 8 0 018 8z"/><path d="M8.5 11h.01M12 11h.01M15.5 11h.01"/></svg>';
  var ICON_SEND = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>';
  var ICON_TEL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 3h3l2 5-2.5 1.6a12 12 0 005.9 5.9L15 13l5 2v3a2 2 0 01-2.2 2A17 17 0 013 5.2A2 2 0 015 3z"/></svg>';
  var ICON_QR = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zM20 14h1M14 20h1M18 18h3v3h-3z"/></svg>';
  var ICON_FORM = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H6v18h12V7l-4-4z"/><path d="M14 3v4h4M9 13h6M9 17h4"/></svg>';

  /* ---------------- 访客身份（存本机，用于接续自己的会话） ---------------- */
  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0;
      return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
    });
  }
  var VK = (function () {
    var k = null;
    try { k = localStorage.getItem("zt_vk"); } catch (e) {}
    if (!k || !/^[0-9a-f-]{36}$/i.test(k)) {
      k = uuid();
      try { localStorage.setItem("zt_vk", k); } catch (e) {}
    }
    return k;
  })();
  var PROFILE = {};        /* 访客填过的称呼/电话，随消息一起带上 */
  var lastId = 0;          /* 已渲染的最大消息 id */
  var pending = [];        /* 本地已显示、等待服务端回显的消息 */
  var pollTimer = null;

  function dbOn() { return !!(window.DB && window.DB.ok && window.DB.ok() && window.DB.chatSend); }

  /* ---------------- 界面骨架 ---------------- */
  var el = document.createElement("div");
  el.innerHTML =
    '<button class="chat-fab" aria-label="在线客服">' + ICON_CHAT + '<span class="chat-dot">1</span></button>' +
    '<div class="chat-panel" role="dialog" aria-label="在线客服">' +

    '<div class="chat-view on" data-view="chat">' +
    '  <div class="chat-head"><span class="avatar">' + (C.mark || "客") + '</span>' +
    '    <span class="info"><b>' + C.title + '</b><small><i></i>' + C.sub + '</small></span>' +
    '    <button class="x chat-new" aria-label="新会话" title="开始新会话">⟳</button>' +
    '    <button class="x" aria-label="关闭" title="关闭">✕</button></div>' +
    '  <div class="chat-body"></div>' +
    '  <div class="chat-chips"></div>' +
    '  <div class="chat-input"><input type="text" placeholder="输入您的问题…" maxlength="200">' +
    '    <button aria-label="发送">' + ICON_SEND + '</button></div>' +
    '  <div class="chat-tools">' +
    '    <button data-goto="tel"><span data-ic="tel"></span>电话咨询</button>' +
    '    <button data-goto="qr"><span data-ic="qr"></span>微信</button>' +
    '    <button data-goto="form"><span data-ic="form"></span>留言</button>' +
    '  </div>' +
    '</div>' +

    '<div class="chat-view" data-view="form">' +
    '  <div class="chat-sub"><button data-back aria-label="返回">‹</button>留下联系方式</div>' +
    '  <div class="chat-form">' +
    '    <div class="field"><label>怎么称呼您 <i>*</i></label><input name="name" type="text" placeholder="如：李经理"></div>' +
    '    <div class="field"><label>联系电话 <i>*</i></label><input name="phone" type="tel" placeholder="手机或固话"></div>' +
    '    <div class="field"><label>需求描述</label><textarea name="msg" placeholder="产品、人数、客户要求……"></textarea></div>' +
    '    <button class="btn btn--primary" type="button">提交留言</button>' +
    '    <div class="ok"></div>' +
    '  </div>' +
    '</div>' +

    '<div class="chat-view" data-view="qr">' +
    '  <div class="chat-sub"><button data-back aria-label="返回">‹</button>添加微信</div>' +
    '  <div class="chat-qr"><img src="' + C.wechatImg + '" alt="微信二维码">' +
    '  <p>扫码添加顾问微信<br>或拨打 <b>' + ((window.SITE.company || {}).phone || "") + '</b></p></div>' +
    '</div>' +

    '</div>';

  document.body.appendChild(el);

  var fab = el.querySelector(".chat-fab");
  var panel = el.querySelector(".chat-panel");
  var badge = el.querySelector(".chat-dot");
  var body = el.querySelector(".chat-body");
  var chips = el.querySelector(".chat-chips");
  var input = el.querySelector(".chat-input input");
  var views = el.querySelectorAll(".chat-view");

  /* 未读数：初始显示1条作提醒，打开过聊天窗后改为真实未读 */
  var unread = 1;
  function setBadge(n) {
    badge.textContent = n;
    badge.style.display = n > 0 ? "grid" : "none";
  }

  el.querySelector('[data-ic="tel"]').innerHTML = ICON_TEL;
  el.querySelector('[data-ic="qr"]').innerHTML = ICON_QR;
  el.querySelector('[data-ic="form"]').innerHTML = ICON_FORM;

  function show(name) {
    views.forEach(function (v) { v.classList.toggle("on", v.getAttribute("data-view") === name); });
  }
  function open() {
    panel.classList.add("open");
    fab.classList.add("is-open");
    unread = 0;
    setBadge(0);
    hideInvite();
    setTimeout(function () { input.focus(); }, 250);
    if (!body.childElementCount) {
      botSay("您好，我是<b>" + (C.mark || "客服") + "</b>。可以点下面的问题快速了解，也可以直接留言，客服看到会回复您。");
      renderChips();
    }
    startPoll();
  }
  function close() {
    panel.classList.remove("open");
    fab.classList.remove("is-open");
    /* 关窗后继续轮询，这样客服回复时未读角标才会跳动 */
  }

  /* ---------------- 10秒未互动 → 主动邀请气泡 ---------------- */
  var invite = document.createElement("div");
  invite.className = "chat-invite";
  invite.innerHTML =
    '<div class="bubble"><button class="x" aria-label="关闭提醒">✕</button>' +
    '您好，我是<b>' + (C.mark || "客服") + '顾问</b>，需要我帮助吗？<br>' +
    '<span class="go">💬 在线咨询</span></div>';
  document.body.appendChild(invite);
  function hideInvite() { invite.classList.remove("show"); }
  invite.querySelector(".bubble").addEventListener("click", function (e) {
    if (e.target.closest(".x")) { hideInvite(); return; }
    hideInvite();
    open();
  });
  /* 页面打开3秒且没点开过聊天窗 → 弹出邀请 */
  setTimeout(function () {
    if (!panel.classList.contains("open")) invite.classList.add("show");
  }, 3000);

  fab.addEventListener("click", function () {
    panel.classList.contains("open") ? close() : open();
  });
  panel.querySelector('.x[aria-label="关闭"]').addEventListener("click", close);
  /* 新会话：换一个访客标识，聊天窗从头开始；旧会话保留在客服后台 */
  panel.querySelector(".chat-new").addEventListener("click", function () {
    if (!confirm("开始新会话？\n本窗口将从头开始；之前的聊天记录仍保留在客服后台。")) return;
    VK = uuid();
    try { localStorage.setItem("zt_vk", VK); } catch (e) {}
    lastId = 0;
    pending = [];
    body.innerHTML = "";
    botSay("您好，我是<b>" + (C.mark || "客服") + "</b>。可以点下面的问题快速了解，也可以直接留言，客服看到会回复您。");
    renderChips();
    stopPoll();
    startPoll();
  });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") close(); });

  /* ---------------- 消息渲染 ---------------- */
  function addMsg(html, me) {
    var m = document.createElement("div");
    m.className = "msg" + (me ? " me" : "");
    m.innerHTML = (me ? "" : '<span class="b-av">' + (C.mark || "客") + '</span>') +
      '<span class="bubble">' + html + '</span>';
    body.appendChild(m);
    body.scrollTop = body.scrollHeight;
    return m;
  }
  function botSay(html) { addMsg(html, false); }
  function meSay(text) { addMsg(escapeHtml(text), true); }

  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function typing(on) {
    var t = body.querySelector(".bubble > .typing");
    if (on && !t) {
      var w = document.createElement("div");
      w.className = "msg";
      w.innerHTML = '<span class="b-av">' + (C.mark || "客") + '</span><span class="bubble"><span class="typing"><i></i><i></i><i></i></span></span>';
      body.appendChild(w);
      body.scrollTop = body.scrollHeight;
    } else if (!on && t) {
      var wrap = t.closest(".msg");
      if (wrap) wrap.remove();
    }
  }

  function renderChips() {
    chips.innerHTML = (C.faqs || []).map(function (f, i) {
      return '<button data-i="' + i + '">' + f.q + "</button>";
    }).join("");
  }

  function answer(text) {
    var t = text.toLowerCase();
    var list = C.faqs || [];
    for (var i = 0; i < list.length; i++) {
      var f = list[i], keys = f.keys || [];
      for (var j = 0; j < keys.length; j++) {
        if (t.indexOf(String(keys[j]).toLowerCase()) !== -1) return f.a;
      }
    }
    return C.fallback || "已收到您的消息，客服看到会尽快回复您。";
  }

  /* ---------------- 与服务端同步 ---------------- */
  function clearPending(text) {
    var i = pending.indexOf(text);
    if (i !== -1) pending.splice(i, 1);
  }

  function poll() {
    if (!dbOn()) return;
    window.DB.chatFetch(VK).then(function (res) {
      var data = res && res.data;
      if (!data || !data.messages) return;
      data.messages.forEach(function (m) {
        if (m.id <= lastId) return;
        lastId = m.id;
        if (m.role === "admin") {
          typing(false);
          botSay(escapeHtml(m.content));
          /* 聊天窗关着时收到客服回复 → 未读角标+1 */
          if (!panel.classList.contains("open")) { unread++; setBadge(unread); }
        } else {
          if (pending.indexOf(m.content) !== -1) { clearPending(m.content); return; }
          meSay(m.content);
        }
      });
    }).catch(function () { /* 离线时静默，不影响本地问答 */ });
  }

  function startPoll() {
    if (pollTimer || !dbOn()) return;
    poll();
    pollTimer = setInterval(poll, 6000);
  }
  function stopPoll() {
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
  }

  /* ---------------- 发送 ---------------- */
  function send() {
    var text = input.value.trim();
    if (!text) return;
    meSay(text);
    pending.push(text);
    input.value = "";
    chips.innerHTML = "";

    if (dbOn()) {
      window.DB.chatSend({ key: VK, name: PROFILE.name, phone: PROFILE.phone, content: text })
        .then(function (res) {
          if (res && res.error) throw res.error;
          if (res && res.data && res.data.ok === false) throw new Error("empty");
          typing(true);
          setTimeout(function () { typing(false); botSay(answer(text)); renderChips(); }, 600);
        })
        .catch(function () {
          clearPending(text);
          botSay("消息发送失败了，请直接拨打 <b>" + ((window.SITE.company || {}).phone || "") + "</b>，或稍后再试。");
        });
      return;
    }

    /* 未接入数据库：本地问答演示 */
    typing(true);
    setTimeout(function () { typing(false); botSay(answer(text)); renderChips(); }, 600);
  }
  el.querySelector(".chat-input button").addEventListener("click", send);
  input.addEventListener("keydown", function (e) { if (e.key === "Enter") send(); });

  chips.addEventListener("click", function (e) {
    if (drag.moved) { drag.moved = false; return; }   /* 拖拽结束不当作点击 */
    var btn = e.target.closest("button");
    if (!btn) return;
    var f = (C.faqs || [])[+btn.getAttribute("data-i")];
    if (!f) return;
    meSay(f.q);
    chips.innerHTML = "";
    typing(true);
    setTimeout(function () { typing(false); botSay(f.a); renderChips(); }, 650);
  });
  /* 电脑上滚轮也可以左右滑快捷问题条 */
  chips.addEventListener("wheel", function (e) {
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      e.preventDefault();
      chips.scrollLeft += e.deltaY;
    }
  }, { passive: false });
  /* 按住鼠标左键拖拽滑动 */
  var drag = { on: false, x: 0, sl: 0, moved: false };
  chips.addEventListener("mousedown", function (e) {
    drag.on = true; drag.moved = false; drag.x = e.pageX; drag.sl = chips.scrollLeft;
  });
  document.addEventListener("mousemove", function (e) {
    if (!drag.on) return;
    var dx = e.pageX - drag.x;
    if (Math.abs(dx) > 4 && !drag.moved) { drag.moved = true; chips.classList.add("dragging"); }
    if (drag.moved) chips.scrollLeft = drag.sl - dx;
  });
  document.addEventListener("mouseup", function () {
    if (drag.on) { drag.on = false; chips.classList.remove("dragging"); }
  });

  /* ---------------- 视图切换 ---------------- */
  el.querySelectorAll("[data-goto]").forEach(function (b) {
    b.addEventListener("click", function () {
      var to = b.getAttribute("data-goto");
      if (to === "tel") { location.href = "tel:" + TEL; return; }
      show(to);
    });
  });
  el.querySelectorAll("[data-back]").forEach(function (b) {
    b.addEventListener("click", function () { show("chat"); });
  });

  /* ---------------- 留言表单 ---------------- */
  /* .chat-form 是 div，没有原生 reset()，手动清空 */
  function clearForm() {
    var f = el.querySelector(".chat-form");
    if (!f) return;
    Array.prototype.forEach.call(f.querySelectorAll("input, textarea"), function (i) { i.value = ""; });
  }

  var formBtn = el.querySelector(".chat-form .btn");
  formBtn.addEventListener("click", function () {
    var name = el.querySelector('.chat-form [name="name"]').value.trim();
    var phone = el.querySelector('.chat-form [name="phone"]').value.trim();
    var msg = el.querySelector('.chat-form [name="msg"]').value.trim();
    var ok = el.querySelector(".chat-form .ok");

    if (!name || !phone) {
      ok.textContent = "请填写称呼和联系电话。";
      ok.classList.add("show");
      return;
    }
    PROFILE.name = name;
    PROFILE.phone = phone;

    if (dbOn()) {
      formBtn.disabled = true;
      formBtn.textContent = "提交中…";
      var lead = msg || "（访客通过留言表单联系）";
      window.DB.chatSend({ key: VK, name: name, phone: phone, content: lead })
        .then(function (res) {
          if (res && res.error) throw res.error;
          ok.textContent = "✅ 已提交，客服会尽快回复您（回复会出现在本聊天窗口）。";
          clearForm();
          show("chat");
          poll();
        })
        .catch(function (err) {
          /* 兜底：聊天通道失败时，至少把客户线索存进留言表，不让询盘丢掉 */
          if (!window.DB.saveMessage) throw (err || new Error("chat"));
          return window.DB.saveMessage({ name: name, phone: phone, content: lead, source: "chat-form" })
            .then(function (r2) {
              if (r2 && r2.error) throw r2.error;
              ok.textContent = "✅ 已提交，客服会尽快联系您。";
              clearForm();
              show("chat");
            });
        })
        .catch(function (e) {
          var code = (e && (e.code || e.message)) || "网络异常";
          ok.textContent = "提交失败（" + String(code).slice(0, 40) + "），请直接拨打 " + ((window.SITE.company || {}).phone || "咨询热线") + "。";
        })
        .finally(function () {
          ok.classList.add("show");
          formBtn.disabled = false;
          formBtn.textContent = "提交留言";
        });
      return;
    }

    ok.textContent = "（演示模式）留言已记录。正式上线请在 site.js 配置数据库。";
    ok.classList.add("show");
  });
})();
