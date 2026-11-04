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

  var sdk = document.createElement("script");
  sdk.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js";
  sdk.onload = boot;
  sdk.onerror = function () { gateResolve(); };
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
        if (res && res.data && res.data.data) deepMerge(window.SITE, res.data.data);
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
        p_name: name, p_phone: phone, p_content: content, p_source: source
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
        p_content: String(o.content || "").slice(0, 2000)
      });
    },
    chatFetch: function (key) {
      return client.rpc("chat_fetch", { p_key: key });
    }
  };
})();
