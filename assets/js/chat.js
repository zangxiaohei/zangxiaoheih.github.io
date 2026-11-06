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
  var ICON_EMOJI = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M8.5 14.5a4.5 4.5 0 007 0"/><path d="M9 9.5h.01M15 9.5h.01" stroke-width="2.4"/></svg>';
  var ICON_IMG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2.5"/><circle cx="8.5" cy="9.5" r="1.6"/><path d="M21 16l-5-5-9 9"/></svg>';
  var ICON_CLIP = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20.5 11.5l-8.6 8.6a5 5 0 01-7.1-7.1l8.2-8.2a3.4 3.4 0 014.8 4.8l-8.1 8.1a1.8 1.8 0 01-2.5-2.5l7.3-7.3"/></svg>';

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
    '  <div class="chat-input">' +
    '    <div class="ci-main">' +
    '      <textarea rows="1" placeholder="' + L("输入您的问题…", "Type your message…") + '" maxlength="2000"></textarea>' +
    '      <button class="ci-send" aria-label="发送"><span>' + L("发送", "Send") + '</span></button>' +
    '    </div>' +
    '    <div class="ci-bar">' +
    '      <button type="button" data-act="emoji" title="' + L("表情 / 表情包", "Emoji / stickers") + '" aria-label="表情">' + ICON_EMOJI + '</button>' +
    '      <button type="button" data-act="img" title="' + L("发送照片", "Send photo") + '" aria-label="发照片">' + ICON_IMG + '</button>' +
    '      <button type="button" data-act="file" title="' + L("发送文件", "Send file") + '" aria-label="发文件">' + ICON_CLIP + '</button>' +
    '      <span class="ci-hint">' + L("照片 / 文件 / 粘贴截图", "Photo / file / paste") + '</span>' +
    '    </div>' +
    '    <div class="ci-panel" hidden>' +
    '      <div class="cp-tabs"><button type="button" data-tab="emoji" class="on">' + L("表情", "Emoji") + '</button>' +
    '        <button type="button" data-tab="stk">' + L("表情包", "Stickers") + '</button></div>' +
    '      <div class="cp-body" data-panel="emoji"></div>' +
    '      <div class="cp-body" data-panel="stk" hidden></div>' +
    '    </div>' +
    '    <input type="file" class="ci-pick" accept="image/*" multiple hidden>' +
    '    <input type="file" class="ci-pick-all" multiple hidden>' +
    '  </div>' +
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
  var input = el.querySelector(".chat-input textarea");
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
    } else {
      /* 重新打开已有记录的窗口：面板展开动画结束前后各贴底一次 */
      stick();
      setTimeout(stick, 350);
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
    lastStamp = 0;
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
  /* 稳定滚底：浏览器在插入后还会继续排版（字体/样式），同步 scrollTop 会差一截。
     先同步滚一次，再在下一帧、以及 120ms 后各补滚一次，保证真正贴底无空白 */
  function stick() {
    body.scrollTop = body.scrollHeight;
    requestAnimationFrame(function () {
      body.scrollTop = body.scrollHeight;
      requestAnimationFrame(function () { body.scrollTop = body.scrollHeight; });
    });
    setTimeout(function () { body.scrollTop = body.scrollHeight; }, 120);
  }
  /* 时间分隔条：首次进会话 / 隔了 5 分钟才出现，不打断阅读 */
  var lastStamp = 0;
  function hhmm(d) {
    function p(n) { return (n < 10 ? "0" : "") + n; }
    return p(d.getHours()) + ":" + p(d.getMinutes());
  }
  function addStamp(text) {
    var s = document.createElement("div");
    s.className = "chat-stamp";
    s.textContent = text;
    body.appendChild(s);
  }
  function addMsg(html, me, cls) {
    var now = Date.now();
    if (!lastStamp) addStamp(L("开始沟通 · " + hhmm(new Date(now)), "Chat started · " + hhmm(new Date(now))));
    else if (now - lastStamp > 5 * 60000) addStamp(hhmm(new Date(now)));
    lastStamp = now;

    var m = document.createElement("div");
    m.className = "msg" + (me ? " me" : "") + (cls ? " " + cls : "");
    m.innerHTML = (me ? "" : '<span class="b-av">' + (C.mark || "客") + '</span>') +
      '<span class="bubble">' + html + '</span>';
    body.appendChild(m);
    stick();
    return m;
  }
  function botSay(html, cls) { addMsg(html, false, cls); }
  function meSay(text) { addMsg(msgHtml(text), true, clsOf(text)); }
  function clsOf(c) { return parseStk(c) ? "stk" : (parseAtt(c) ? "att" : ""); }

  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  /* ---------------- 表情包 ----------------
     消息 content 以 [[stk]] 开头时后面是 {"id":"zai"}，渲染成本地打包的表情图，
     不占用存储、秒开；网站和后台两端都认这个格式。 */
  var STICKER_BASE = (function () {
    var ss = document.getElementsByTagName("script");
    for (var i = 0; i < ss.length; i++) {
      var src = ss[i].src || "";
      if (/assets\/js\/chat\.js/.test(src)) return src.replace(/assets\/js\/chat\.js.*$/, "assets/img/stickers/");
    }
    return "assets/img/stickers/";
  })();
  var STICKERS = [
    { id: "zai", t: "在的" }, { id: "shoudao", t: "收到" }, { id: "xiexie", t: "谢谢" },
    { id: "shaodeng", t: "稍等" }, { id: "haode", t: "好的" }, { id: "dianzan", t: "点赞" },
    { id: "qingwen", t: "请问" }, { id: "jiayou", t: "加油" }, { id: "meiwenti", t: "没问题" },
    { id: "mashang", t: "马上办" }, { id: "xinku", t: "辛苦啦" }, { id: "zaijian", t: "再见" }
  ];
  function stkUrl(id) {
    return STICKER_BASE + String(id || "").replace(/[^a-z0-9_-]/gi, "") + ".svg";
  }
  function parseStk(content) {
    var s = String(content || "");
    if (s.indexOf("[[stk]]") !== 0) return null;
    try {
      var o = JSON.parse(s.slice(7));
      return (o && o.id) ? o : null;
    } catch (e) { return null; }
  }

  /* ---------------- 附件消息（图片 / 文件） ----------------
     约定：消息 content 以 [[att]] 开头时，后面跟一段 JSON：
       {"u":"公开链接","n":"文件名","s":字节数,"t":"MIME"}
       {"imgs":[{...},{...}]}                          一次发的多张图片
     纯文本消息完全不受影响，老消息照常显示。 */
  function parseAtt(content) {
    var s = String(content || "");
    if (s.indexOf("[[att]]") !== 0) return null;
    try {
      var o = JSON.parse(s.slice(7));
      if (o && o.imgs && o.imgs.length) return { imgs: o.imgs };
      return (o && o.u) ? o : null;
    } catch (e) { return null; }
  }
  function attItems(a) { return (a && a.imgs) ? a.imgs : [a]; }
  function humanSize(n) {
    n = +n || 0;
    if (n <= 0) return "";
    if (n < 1024) return n + " B";
    if (n < 1048576) return Math.round(n / 1024) + " KB";
    return (n / 1048576).toFixed(1) + " MB";
  }
  function fileTag(name) {
    var ext = String(name || "").split(".").pop().toLowerCase();
    if (ext === "pdf") return "PDF";
    if (/^(doc|docx)$/.test(ext)) return "DOC";
    if (/^(xls|xlsx|csv)$/.test(ext)) return "XLS";
    if (/^(ppt|pptx)$/.test(ext)) return "PPT";
    if (/^(zip|rar|7z)$/.test(ext)) return "ZIP";
    if (/^(png|jpe?g|gif|webp)$/.test(ext)) return "IMG";
    return "FILE";
  }
  function isImg(a) {
    return /^image\//.test(a.t || "") || /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(a.u || "");
  }
  function attHtml(a) {
    var list = attItems(a);
    var imgs = list.filter(isImg);
    var files = list.filter(function (x) { return !isImg(x); });
    var html = "";

    if (imgs.length === 1) {
      html += '<a class="att-img" href="' + escapeHtml(imgs[0].u) + '" target="_blank" rel="noopener">' +
        '<img src="' + escapeHtml(imgs[0].u) + '" alt="' + escapeHtml(imgs[0].n || "图片") + '" loading="lazy"></a>';
    } else if (imgs.length > 1) {
      html += '<div class="att-grid n' + Math.min(imgs.length, 4) + '">' + imgs.slice(0, 4).map(function (g, i) {
        return '<a class="att-img" href="' + escapeHtml(g.u) + '" target="_blank" rel="noopener">' +
          '<img src="' + escapeHtml(g.u) + '" alt="' + escapeHtml(g.n || "图片") + '" loading="lazy">' +
          (i === 3 && imgs.length > 4 ? '<i class="att-more">+' + (imgs.length - 4) + '</i>' : "") + '</a>';
      }).join("") + '</div>';
    }

    files.forEach(function (f) {
      html += '<a class="att-file" href="' + escapeHtml(f.u) + '" target="_blank" rel="noopener" download="' +
        escapeHtml(f.n || "file") + '">' +
        '<span class="af-ic">' + fileTag(f.n || f.u) + '</span>' +
        '<span class="af-tx"><b>' + escapeHtml(f.n || "文件") + '</b><small>' + humanSize(f.s) + '</small></span>' +
        '<span class="af-dl">↓</span></a>';
    });
    return html;
  }
  function msgHtml(content) {
    var st = parseStk(content);
    if (st) {
      return '<span class="att-stk"><img src="' + escapeHtml(stkUrl(st.id)) + '" alt="' +
        escapeHtml(st.t || "表情") + '" loading="lazy"></span>';
    }
    var a = parseAtt(content);
    if (a) return attHtml(a);
    return escapeHtml(content).replace(/\n/g, "<br>");
  }

  function typing(on) {
    var t = body.querySelector(".bubble > .typing");
    if (on && !t) {
      var w = document.createElement("div");
      w.className = "msg";
      w.innerHTML = '<span class="b-av">' + (C.mark || "客") + '</span><span class="bubble"><span class="typing"><i></i><i></i><i></i></span></span>';
      body.appendChild(w);
      stick();
    } else if (!on && t) {
      var wrap = t.closest(".msg");
      if (wrap) wrap.remove();
      stick();
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
          botSay(msgHtml(m.content), clsOf(m.content));
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

  /* ---------------- 附件上传 / 表情 ---------------- */
  var pickImg = el.querySelector(".ci-pick");
  var pickAll = el.querySelector(".ci-pick-all");
  var emojiBox = el.querySelector(".ci-panel");
  var barHint = el.querySelector(".ci-hint");
  var MAX_FILE = 10 * 1048576;
  var MAX_SIDE = 1600;
  var uploading = false;

  var viewer = document.createElement("div");
  viewer.className = "chat-viewer";
  viewer.innerHTML = '<img alt="预览"><button class="x" aria-label="关闭">✕</button>';
  el.appendChild(viewer);
  function showViewer(src) {
    viewer.querySelector("img").src = src;
    viewer.classList.add("show");
  }
  viewer.addEventListener("click", function (e) {
    if (e.target === viewer || e.target.classList.contains("x")) viewer.classList.remove("show");
  });

  function autoGrow() {
    input.style.height = "auto";
    input.style.height = Math.min(input.scrollHeight, 110) + "px";
  }

  function setBarBusy(on) {
    el.querySelectorAll(".ci-bar button").forEach(function (b) { b.disabled = !!on; });
    if (barHint) barHint.textContent = on ? L("上传中…", "Uploading…") : L("照片 / 文件 / 粘贴截图", "Photo / file / paste");
  }

  /* 图片压缩：长边不超过 1600px、JPEG 质量 0.82，手机上几 MB 的照片会变成两三百 KB */
  function compressImage(file) {
    return new Promise(function (resolve) {
      if (!/^image\//.test(file.type || "") || /gif|svg/.test(file.type || "")) return resolve(file);
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        try {
          var w = img.naturalWidth, h = img.naturalHeight;
          var scale = Math.min(1, MAX_SIDE / Math.max(w, h));
          if (scale >= 1 && file.size < 700 * 1024) { URL.revokeObjectURL(url); return resolve(file); }
          var c = document.createElement("canvas");
          c.width = Math.round(w * scale); c.height = Math.round(h * scale);
          c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
          c.toBlob(function (blob) {
            URL.revokeObjectURL(url);
            if (!blob) return resolve(file);
            resolve(new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" }));
          }, "image/jpeg", 0.82);
        } catch (e) { URL.revokeObjectURL(url); resolve(file); }
      };
      img.onerror = function () { URL.revokeObjectURL(url); resolve(file); };
      img.src = url;
    });
  }

  function sendAttachments(files) {
    var list = Array.prototype.slice.call(files || []).filter(Boolean);
    if (!list.length) return;
    if (!dbOn()) {
      botSay(L("当前是演示模式，附件需要先连接数据库。", "Demo mode: connect the database to send files."));
      return;
    }
    if (uploading) { botSay(L("上一个附件还在上传，请稍等。", "Still uploading, please wait.")); return; }
    if (list.length > 6) list = list.slice(0, 6);

    var imgs = list.filter(function (f) { return /^image\//.test(f.type || ""); });
    var others = list.filter(function (f) { return !/^image\//.test(f.type || ""); });

    uploading = true;
    setBarBusy(true);

    /* 一次选的图片合成一条消息（九宫格），文件各发一条 */
    var jobs = [];
    if (imgs.length) jobs.push({ imgs: true, files: imgs });
    others.forEach(function (f) { jobs.push({ imgs: false, files: [f] }); });

    var qi = 0, done = 0;
    var total = list.length;
    var ph = addMsg('<span class="att-up">' + L("正在上传", "Uploading") + ' <b class="up-n">0/' + total + '</b></span>', true);

    function finish() {
      uploading = false;
      setBarBusy(false);
      if (ph) { ph.remove(); ph = null; }
    }

    (function nextJob() {
      if (qi >= jobs.length) { finish(); return; }
      var job = jobs[qi++];
      var got = [], bad = 0;

      (function step() {
        if (!job.files.length) {
          if (got.length) sendOne(job.imgs ? { imgs: got } : got[0]);
          return nextJob();
        }
        var f = job.files.shift();
        if (f.size > MAX_FILE) {
          botSay(L("「" + f.name + "」超过 10MB，没有发送。", "\"" + f.name + "\" is over 10MB, not sent."));
          bad++;
          return step();
        }
        compressImage(f).then(function (out) {
          return window.DB.uploadChatFile(out, VK);
        }).then(function (r) {
          got.push({ u: r.url, n: f.name, s: f.size, t: f.type || "" });
        }).catch(function (e) {
          bad++;
          var m = String((e && (e.message || e.error_description)) || e || "");
          botSay(/bucket|not found/i.test(m)
            ? L("附件功能还没启用：请先让管理员打开「发图片/文件」配置页跑一次 SQL。",
                "File sending is not enabled yet: an admin needs to run the storage setup once.")
            : L("上传失败：" + (m || "网络异常") + "，请重试或直接发文字。",
                "Upload failed: " + (m || "network error") + ". Please retry."));
        }).then(function () {
          done++;
          var n = ph && ph.querySelector(".up-n");
          if (n) n.textContent = done + "/" + total;
          step();
        });
      })();
    })();

    /* 上传完成 → 先本地显示，再写库；pending 用于服务端回显去重 */
    function sendOne(payload) {
      var content = "[[att]]" + JSON.stringify(payload);
      meSay(content);
      pending.push(content);
      window.DB.chatSend({ key: VK, name: PROFILE.name, phone: PROFILE.phone, content: content })
        .then(function (res) {
          if (res && res.error) throw res.error;
          var d = res && res.data;
          if (d && d.ok === false) {
            if (d.error === "limit") { enterLimited(); return; }
            throw new Error(d.error || "send");
          }
        })
        .catch(function () {
          clearPending(content);
          botSay(L("附件已经传上去了，但消息没发出去，请刷新后再试一次。",
                   "Uploaded but the message failed. Please refresh and retry."));
        });
    }
  }

  el.querySelector('[data-act="img"]').addEventListener("click", function () { pickImg.click(); });
  el.querySelector('[data-act="file"]').addEventListener("click", function () { pickAll.click(); });
  pickImg.addEventListener("change", function () { sendAttachments(this.files); this.value = ""; });
  pickAll.addEventListener("change", function () { sendAttachments(this.files); this.value = ""; });

  /* 表情面板：两个页签 —— 表情（文字 emoji，插到输入框）/ 表情包（图片，直接发出） */
  var EMOJIS = ("😀 😃 😄 😁 😊 🙂 😉 😍 🤝 👍 👏 🙏 💪 🔥 ✨ 🎉 ✅ ❓ ❗ ⏰ 📞 📱 📧 📄 📎 📌 " +
    "🏆 🎯 💡 📊 🌍 🏭 🔧 🧪 🧾 💰 🤔 😅 😢 🙌 👌 🆗 💬 👉 ⭐ 🌟 🚀 ⏳ 📅 📍 ✍️ 🖼").split(" ");
  function insertAtCursor(str) {
    var s = input.selectionStart || 0, en = input.selectionEnd || 0;
    var v = input.value;
    input.value = v.slice(0, s) + str + v.slice(en);
    var pos = s + str.length;
    try { input.setSelectionRange(pos, pos); } catch (e) { }
    input.focus();
    autoGrow();
  }
  function buildPanel() {
    var emoBody = emojiBox.querySelector('[data-panel="emoji"]');
    var stkBody = emojiBox.querySelector('[data-panel="stk"]');
    emoBody.innerHTML = EMOJIS.map(function (e) { return '<button type="button" data-emoji="' + e + '">' + e + "</button>"; }).join("");
    stkBody.innerHTML = STICKERS.map(function (s) {
      return '<button type="button" class="cp-stk" data-stk="' + s.id + '" title="' + escapeHtml(s.t) + '">' +
        '<img src="' + escapeHtml(stkUrl(s.id)) + '" alt="' + escapeHtml(s.t) + '" loading="lazy"></button>';
    }).join("");
  }
  function toggleEmoji(force, tab) {
    var show = force === undefined ? emojiBox.hidden : force;
    if (show && !emojiBox.dataset.built) { buildPanel(); emojiBox.dataset.built = "1"; }
    emojiBox.hidden = !show;
    el.querySelector('[data-act="emoji"]').classList.toggle("on", !!show);
    if (show && tab) switchTab(tab);
  }
  function switchTab(tab) {
    emojiBox.querySelectorAll(".cp-tabs button").forEach(function (b) {
      b.classList.toggle("on", b.getAttribute("data-tab") === tab);
    });
    emojiBox.querySelectorAll(".cp-body").forEach(function (b) {
      b.hidden = b.getAttribute("data-panel") !== tab;
    });
    emojiBox.scrollTop = 0;
  }
  el.querySelector('[data-act="emoji"]').addEventListener("click", function () { toggleEmoji(); });
  emojiBox.querySelector(".cp-tabs").addEventListener("click", function (e) {
    var b = e.target.closest("button[data-tab]");
    if (b) switchTab(b.getAttribute("data-tab"));
  });
  emojiBox.addEventListener("click", function (e) {
    var sk = e.target.closest("[data-stk]");
    if (sk) { sendSticker(sk.getAttribute("data-stk")); return; }
    var b = e.target.closest("[data-emoji]");
    if (b) insertAtCursor(b.getAttribute("data-emoji"));
  });

  /* 点面板以外的地方收起表情面板 */
  document.addEventListener("click", function (e) {
    if (emojiBox.hidden) return;
    if (emojiBox.contains(e.target) || (e.target.closest && e.target.closest('[data-act="emoji"]'))) return;
    toggleEmoji(false);
  });

  /* 发表情包：content 只存 id，图片是本地资源，不占存储、打开即显示 */
  function sendSticker(id) {
    var st = null;
    for (var i = 0; i < STICKERS.length; i++) if (STICKERS[i].id === id) st = STICKERS[i];
    if (!st) return;
    var content = "[[stk]]" + JSON.stringify({ id: st.id, t: st.t });
    meSay(content);
    toggleEmoji(false);
    if (!dbOn()) return;
    pending.push(content);
    window.DB.chatSend({ key: VK, name: PROFILE.name, phone: PROFILE.phone, content: content })
      .then(function (res) {
        if (res && res.error) throw res.error;
        var d = res && res.data;
        if (d && d.ok === false && d.error === "limit") enterLimited();
      })
      .catch(function () {
        clearPending(content);
        botSay(L("表情没发出去，请检查网络后重试。", "Sticker failed to send. Please check your network."));
      });
  }

  /* 粘贴截图 / 拖拽文件 */
  input.addEventListener("paste", function (e) {
    var items = (e.clipboardData && e.clipboardData.items) || [];
    var imgs = [];
    for (var i = 0; i < items.length; i++) {
      if (items[i].kind === "file" && /^image\//.test(items[i].type || "")) {
        var f = items[i].getAsFile();
        if (f) imgs.push(f);
      }
    }
    if (imgs.length) { e.preventDefault(); sendAttachments(imgs); }
  });
  panel.addEventListener("dragover", function (e) { e.preventDefault(); panel.classList.add("drag-over"); });
  panel.addEventListener("dragleave", function (e) {
    if (!panel.contains(e.relatedTarget)) panel.classList.remove("drag-over");
  });
  panel.addEventListener("drop", function (e) {
    e.preventDefault();
    panel.classList.remove("drag-over");
    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) sendAttachments(e.dataTransfer.files);
  });

  /* 点图片在原窗口放大，不跳走页面 */
  body.addEventListener("click", function (e) {
    var a = e.target.closest(".att-img");
    if (!a) return;
    e.preventDefault();
    showViewer(a.getAttribute("href"));
  });

  /* ---------------- 发送 ---------------- */
  function send() {
    var text = input.value.trim();
    if (!text) return;
    meSay(text);
    pending.push(text);
    input.value = "";
    autoGrow();
    toggleEmoji(false);
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
  el.querySelector(".chat-input .ci-send").addEventListener("click", send);
  input.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(); }
  });
  input.addEventListener("input", autoGrow);

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
