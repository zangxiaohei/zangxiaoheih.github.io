/* ==========================================================================
   数据库连接层
   职责：
     1. 读取 db-config.js 配置，动态加载 Supabase SDK
     2. 页面渲染前，把数据库里的站点内容合并进 window.SITE（后台改的内容生效）
     3. 对外提供 window.DB.saveMessage()：客户留言写入 messages 表
   无配置 / 加载失败时静默降级，网站不受影响
   ========================================================================== */
(function () {
  "use strict";
  var cfg = window.SUPABASE_CONFIG || {};

  /* 未配置：不设门闩，site.js 直接渲染，走演示模式 */
  if (!cfg.url || !cfg.anonKey) return;

  var gateResolve;
  window.__dbGate = new Promise(function (res) { gateResolve = res; });

  /* SDK 优先用本地自托管版本（国内访问 CDN 不稳），失败再回退官方 CDN */
  var sdk = document.createElement("script");
  var CDN = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js";
  var triedCdn = false;
  sdk.src = "assets/vendor/supabase.min.js";
  sdk.onload = boot;
  sdk.onerror = function () {
    if (triedCdn) { gateResolve(); return; }
    triedCdn = true;
    var s2 = document.createElement("script");
    s2.src = CDN;
    s2.onload = boot;
    s2.onerror = function () { gateResolve(); };
    document.head.appendChild(s2);
  };
  document.head.appendChild(sdk);

  var client = null;

  function boot() {
    try {
      client = window.supabase.createClient(cfg.url, cfg.anonKey);
    } catch (e) {
      gateResolve();
      return;
    }
    client
      .from("site_content")
      .select("data")
      .eq("key", "site")
      .maybeSingle()
      .then(function (res) {
        if (res && res.data && res.data.data) {
          deepMerge(window.SITE, res.data.data);
          /* 英文模式：后台中文内容合并后，重新套用英文数据，避免覆盖 */
          if (window.LANG === "en" && window.__i18nApplyData) window.__i18nApplyData();
        }
      })
      .catch(function () { /* 数据库暂不可达时用本地默认内容 */ })
      .finally(function () { gateResolve(); });
  }

  /* 深合并：数据库的值覆盖默认值；数组整体替换 */
  function deepMerge(base, over) {
    if (!over) return base;
    for (var k in over) {
      if (!Object.prototype.hasOwnProperty.call(over, k)) continue;
      var v = over[k];
      if (Array.isArray(v)) { base[k] = v; }
      else if (v && typeof v === "object" && base[k] && typeof base[k] === "object" && !Array.isArray(base[k])) {
        deepMerge(base[k], v);
      } else if (v !== undefined && v !== null) {
        base[k] = v;
      }
    }
    return base;
  }

  /* 对外接口：保存留言（聊天框 / 联系页共用） */
  window.DB = {
    ok: function () { return !!client; },
    saveMessage: function (m) {
      var name = String(m.name || "").slice(0, 80);
      var phone = String(m.phone || "").slice(0, 40);
      var content = String(m.content || "").slice(0, 2000);
      var source = m.source || "web";
      /* 优先走安全函数（策略出问题也能写入），失败再退回直写表 */
      return client.rpc("web_save_message", {
        p_name: name, p_phone: phone, p_content: content, p_source: source,
        p_token: m.token || ""
      }).then(function (res) {
        if (res && res.error) return client.from("messages").insert([{ name: name, phone: phone, content: content, source: source }]);
        return res;
      });
    },
    /* 在线客服：访客发消息 / 拉取自己的会话 */
    chatSend: function (o) {
      return client.rpc("chat_visitor_send", {
        p_key: o.key,
        p_name: o.name || null,
        p_phone: o.phone || null,
        p_content: String(o.content || "").slice(0, 2000),
        p_need_captcha: !!o.needCaptcha,
        p_token: o.token || ""
      });
    },
    chatFetch: function (key) {
      return client.rpc("chat_fetch", { p_key: key });
    },

    /* 已读回执：访客看过客服回复后调一次，后台气泡就会显示「已读」。
       走 security definer 函数，匿名身份也能调，但只能动自己这条会话 */
    chatMarkRead: function (key) {
      if (!client || !key) return Promise.resolve(null);
      return client.rpc("chat_mark_read", { p_key: key });
    },

    /* 已读状态：返回 { last_read: 客服读到的最大条 id, unread: 还没读的条数 }
       访客端靠它把自己的消息标成「已送达 / 已读」，配置见 admin/chat-read-state.sql */
    chatReadState: function (key) {
      if (!client || !key) return Promise.resolve(null);
      return client.rpc("chat_read_state", { p_key: key });
    },

    /* 聊天附件上传（图片 / 文件）→ 返回公开链接
       桶名固定 chat-files，配置见 admin/chat-files.sql */
    uploadChatFile: function (file, key) {
      if (!client) return Promise.reject(new Error("offline"));
      var name = String((file && file.name) || "file");
      var ext = (name.split(".").pop() || "").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 6) || "bin";
      if (ext === name.toLowerCase()) ext = "bin";
      var path = String(key || "anon") + "/" + Date.now() + "_" +
        Math.random().toString(36).slice(2, 8) + "." + ext;
      return client.storage.from("chat-files")
        .upload(path, file, { contentType: (file && file.type) || "application/octet-stream", upsert: false })
        .then(function (res) {
          if (res && res.error) throw res.error;
          var pub = client.storage.from("chat-files").getPublicUrl(path);
          return { url: pub.data.publicUrl, path: path };
        });
    }
  };
})();
