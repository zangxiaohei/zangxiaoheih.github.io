/* ==========================================================================
   Cloudflare Turnstile 人机验证助手（防垃圾灌水）
   用法：
     TS.token(".ts-slot", function (t) { ... 用 t 提交 ... });
   说明：
   - turnstileSiteKey 为空时直接返回空 token（未启用验证，不加载脚本）
   - 每次调用都会重新渲染一个隐形组件，天然保证 token 一次性
   - 脚本加载失败（网络被墙等）也返回空 token，由服务端决定是否放行
   ========================================================================== */
(function () {
  var siteKey = (window.SUPABASE_CONFIG && window.SUPABASE_CONFIG.turnstileSiteKey) || "";
  var loaded = false, loading = false, waiters = [];

  function flush() {
    waiters.splice(0).forEach(function (cb) { cb(); });
  }
  function load(cb) {
    if (loaded) return cb();
    waiters.push(cb);
    if (loading) return;
    loading = true;
    var s = document.createElement("script");
    s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    s.async = true;
    s.onload = function () { loaded = true; flush(); };
    s.onerror = function () { flush(); };  /* 失败也放行等待者（token 为空） */
    document.head.appendChild(s);
  }

  window.TS = {
    enabled: !!siteKey,
    /* container: 放隐形验证组件的元素（选择器或 DOM）；done(token) 完成回调 */
    token: function (container, done) {
      if (!siteKey) { done(""); return; }
      var el = typeof container === "string" ? document.querySelector(container) : container;
      if (!el) { done(""); return; }
      load(function () {
        if (!window.turnstile) { done(""); return; }
        try { el.innerHTML = ""; } catch (e) {}
        var finished = false;
        try {
          window.turnstile.render(el, {
            sitekey: siteKey,
            size: "invisible",
            callback: function (t) { if (!finished) { finished = true; done(t || ""); } },
            "error-callback": function () { if (!finished) { finished = true; done(""); } },
            "timeout-callback": function () { if (!finished) { finished = true; done(""); } }
          });
          /* 8 秒兜底：一直不出结果就放行空 token */
          setTimeout(function () { if (!finished) { finished = true; done(""); } }, 8000);
        } catch (e) { if (!finished) { finished = true; done(""); } }
      });
    }
  };
})();
