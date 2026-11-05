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

  /* 文案双语：L("中文", "English")；未加载 i18n.js 时回落到中文 */
  function L(zh, en) { return (window.LANG === "en" && en) ? en : zh; }
  var HELLO = L(
    "您好，我是<b>" + (C.mark || "客服") + "</b>。可以点下面的问题快速了解，也可以直接留言，客服看到会回复您。",
    "Hi! I'm the <b>Zenithe</b> assistant. Tap a question below for a quick answer, or leave a message — our team replies as soon as they see it."
  );

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
  var humanReplied = false; /* 客服人工回复过 → 机器人停止自动回复 */
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
    '  <div class="chat-limit" style="display:none"></div>' +
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
    '    <div class="ts-slot" aria-hidden="true"></div>' +
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
    chatOpened = true;
    hideInvite();
    /* 当天已触发限额：每次打开都重新检查（防止漏判） */
    if (limitedToday()) enterLimited();
    setTimeout(function () { input.focus(); }, 250);
    if (!body.childElementCount) {
      botSay(HELLO);
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
    '<div class="bubble"><button class="x" aria-label="' + L("关闭提醒", "Dismiss") + '">✕</button>' +
    L(
      "您好，我是<b>" + (C.mark || "客服") + "顾问</b>，需要我帮助吗？<br><span class=\"go\">💬 在线咨询</span>",
      "Hi, need any help with certification?<br><span class=\"go\">💬 Chat now</span>"
    ) + "</div>";
  document.body.appendChild(invite);
  function hideInvite() { invite.classList.remove("show"); }
  var chatOpened = false;   /* 打开过聊天窗后邀请永久停止 */
  function popInvite(delay) {
    setTimeout(function () {
      if (!chatOpened && !panel.classList.contains("open")) invite.classList.add("show");
    }, delay);
  }
  invite.querySelector(".bubble").addEventListener("click", function (e) {
    if (e.target.closest(".x")) {
      /* 关闭提醒 → 5秒后继续弹，直到访客打开聊天窗为止 */
      hideInvite();
      popInvite(5000);
      return;
    }
    hideInvite();
    open();
  });
  /* 页面打开3秒且没点开过聊天窗 → 弹出邀请 */
  popInvite(3000);

  fab.addEventListener("click", function () {
    panel.classList.contains("open") ? close() : open();
  });
  panel.querySelector('.x[aria-label="关闭"]').addEventListener("click", close);
  /* 新会话：换一个访客标识，聊天窗从头开始；旧会话保留在客服后台 */
  panel.querySelector(".chat-new").addEventListener("click", function () {
    if (!confirm(L("开始新会话？\n本窗口将从头开始；之前的聊天记录仍保留在客服后台。",
                   "Start a new conversation?\nThis window restarts from scratch; earlier messages stay in our back office."))) return;
    VK = uuid();
    try { localStorage.setItem("zt_vk", VK); } catch (e) {}
    lastId = 0;
    humanReplied = false;
    pending = [];
    body.innerHTML = "";
    botSay(HELLO);
    renderChips();
    stopPoll();
    startPoll();
  });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") close(); });
  /* 支持 ?chat=open 直接打开聊天窗（可用于广告落地页直达客服） */
  if (/[?&]chat=open/.test(location.search)) setTimeout(open, 300);

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
    return C.fallback || L("已收到您的消息，客服看到会尽快回复您。", "Message received — our team will get back to you shortly.");
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
          humanReplied = true; /* 人工已接入，后续不再自动回复 */
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
          if (res && res.data && res.data.ok === false) {
            if (res.data.error === "limit") { enterLimited(); return; }
            throw new Error("empty");
          }
          if (humanReplied) return; /* 客服人工已接入，等人工回复 */
          typing(true);
          setTimeout(function () {
            typing(false);
            if (!humanReplied) botSay(answer(text));
            renderChips();
          }, 600);
        })
        .catch(function () {
          clearPending(text);
          botSay(L("消息发送失败了，请直接拨打 <b>" + ((window.SITE.company || {}).phone || "") + "</b>，或稍后再试。",
                   "Sending failed. Please call <b>" + ((window.SITE.company || {}).phone || "") + "</b> or try again later."));
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
    if (humanReplied) return; /* 人工接入后快捷问题也不再自动答 */
    typing(true);
    setTimeout(function () {
      typing(false);
      if (!humanReplied) botSay(f.a);
      renderChips();
    }, 650);
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

  /* ---------------- 每日限额：超出 100 条强制电话联系 ---------------- */
  var LIMIT_MAX = 100;
  var LIMIT_KEY = "zt_limit_date";
  function todayStr() {
    var d = new Date();
    return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
  }
  function limitedToday() {
    try { return localStorage.getItem(LIMIT_KEY) === todayStr(); } catch (e) { return false; }
  }
  var limitEntered = false;
  function enterLimited() {
    if (limitEntered) return;
    limitEntered = true;
    try { localStorage.setItem(LIMIT_KEY, todayStr()); } catch (e) {}
    var phone = (window.SITE.company || {}).phone || "";
    var box = el.querySelector(".chat-limit");
    if (box) {
      box.innerHTML =
        '<p>' + L("您今天的咨询消息已达上限（" + LIMIT_MAX + " 条），为不耽误您的问题，请直接联系：",
                  "You've reached today's chat limit (" + LIMIT_MAX + " messages). To avoid delay, please contact us directly:") + '</p>' +
        '<a class="btn btn--primary" href="tel:' + phone + '">📞 ' + phone + '</a>' +
        '<button class="btn btn--line" data-limit-form>' + L("提交留言，我们回电", "Leave a message instead") + '</button>';
      box.style.display = "block";
      box.querySelector("[data-limit-form]").addEventListener("click", function () { show("form"); });
    }
    var iw = el.querySelector(".chat-input");
    if (iw) iw.style.display = "none";
    botSay(L("为保障服务质量，今天的咨询次数已用完。请拨打 <b>" + phone + "</b> 或提交留言，我们会尽快回电。",
             "You've used up today's chat quota. Please call <b>" + phone + "</b> or leave a message and we'll call back."));
  }
  /* 当天已触发过限额：打开聊天窗直接进入电话联系模式 */
  if (limitedToday()) setTimeout(enterLimited, 400);

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
      ok.textContent = L("请填写称呼和联系电话。", "Please fill in your name and phone number.");
      ok.classList.add("show");
      return;
    }
    PROFILE.name = name;
    PROFILE.phone = phone;

    var submitLead = function (tsToken) {
      formBtn.disabled = true;
      formBtn.textContent = L("提交中…", "Sending…");
      var lead = msg || L("（访客通过留言表单联系）", "(Visitor contacted us via the message form)");
      window.DB.chatSend({ key: VK, name: name, phone: phone, content: lead, needCaptcha: true, token: tsToken })
        .then(function (res) {
          if (res && res.error) throw res.error;
          var d = res && res.data;
          if (d && d.ok === false && d.error === "limit") {
            ok.textContent = L("今天的咨询次数已达上限，请直接拨打 " + ((window.SITE.company || {}).phone || "客服电话") + " 联系我们。",
                               "You've reached today's chat limit. Please call " + ((window.SITE.company || {}).phone || "us") + " directly.");
            enterLimited();
            return;
          }
          if (d && d.ok === false && d.error === "captcha") {
            ok.textContent = L("人机验证未通过，请重新提交。", "Verification failed. Please try again.");
            return;
          }
          if (d && d.ok === false) throw new Error(d.error || "empty");
          ok.textContent = L("✅ 已提交，客服会尽快回复您（回复会出现在本聊天窗口）。",
                             "✅ Sent. Our team will reply here shortly.");
          clearForm();
          show("chat");
          poll();
        })
        .catch(function (err) {
          /* 兜底：聊天通道失败时，至少把客户线索存进留言表，不让询盘丢掉 */
          if (!window.DB.saveMessage) throw (err || new Error("chat"));
          return window.DB.saveMessage({ name: name, phone: phone, content: lead, source: "chat-form", token: tsToken })
            .then(function (r2) {
              if (r2 && r2.error) throw r2.error;
              if (r2 && r2.data && r2.data.ok === false) throw new Error(r2.data.error || "captcha");
              ok.textContent = L("✅ 已提交，客服会尽快联系您。", "✅ Sent. Our team will contact you shortly.");
              clearForm();
              show("chat");
            });
        })
        .catch(function (e) {
          var code = (e && (e.code || e.message)) || L("网络异常", "Network error");
          if (String(code) === "captcha") {
            ok.textContent = L("人机验证未通过，请重新提交。", "Verification failed. Please try again.");
          } else {
            ok.textContent = L(
              "提交失败（" + String(code).slice(0, 40) + "），请直接拨打 " + ((window.SITE.company || {}).phone || "咨询热线") + "。",
              "Submission failed (" + String(code).slice(0, 40) + "). Please call " + ((window.SITE.company || {}).phone || "our hotline") + "."
            );
          }
        })
        .finally(function () {
          ok.classList.add("show");
          formBtn.disabled = false;
          formBtn.textContent = L("提交留言", "Send message");
        });
    };

    if (dbOn()) {
      /* 人机验证：Turnstile 启用时先拿 token 再提交 */
      if (window.TS && window.TS.enabled) {
        formBtn.disabled = true;
        formBtn.textContent = L("安全验证中…", "Verifying…");
        window.TS.token(".chat-form .ts-slot", submitLead);
      } else {
        submitLead("");
      }
      return;
    }

    ok.textContent = L("（演示模式）留言已记录。正式上线请在 site.js 配置数据库。",
                       "(Demo mode) Message saved locally. Connect the database in site.js before going live.");
    ok.classList.add("show");
  });
})();
