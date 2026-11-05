/* ==========================================================================
   站点脚本：负责把 assets/data/site.js 里的内容渲染到页面上
   一般不需要修改这个文件（除非你要加新的板块）
   ========================================================================== */
(function () {
  "use strict";

  var S = window.SITE || {};

  /* ---------------- 图标库（线性图标，跟随文字颜色） ---------------- */
  var ICONS = {
    shield: '<path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z"/><path d="M9 12l2 2 4-4"/>',
    leaf: '<path d="M4 20c0-8 5-14 16-15 1 10-4 15-11 15H4z"/><path d="M4 20c3-5 7-8 12-10"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.5 3 14 0 18M12 3c-3 3.5-3 14 0 18"/>',
    award: '<circle cx="12" cy="9" r="5"/><path d="M8.5 13.5L7 21l5-2.6L17 21l-1.5-7.5"/>',
    check: '<circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.8 2.8L16 10"/>',
    chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    recycle: '<path d="M7 19H5a2 2 0 01-1.7-3l2.3-3.8"/><path d="M9.5 5.6l1.2-2a2 2 0 013.4 0l2.3 3.9"/><path d="M17 19h2a2 2 0 002-3l-2-3.4"/><path d="M9 19h6M12 9l-3 5h6l-3-5z"/>',
    users: '<circle cx="9" cy="8" r="3.4"/><path d="M3 20c0-3.3 2.7-5.6 6-5.6s6 2.3 6 5.6"/><path d="M17 8.2a3 3 0 010 5.6M18 20c0-2.4-.8-4.2-2-5.2"/>',
    phone: '<path d="M5 3h3l2 5-2.5 1.6a12 12 0 005.9 5.9L15 13l5 2v3a2 2 0 01-2.2 2A17 17 0 013 5.2A2 2 0 015 3z"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
    pin: '<path d="M12 21s7-6 7-11a7 7 0 10-14 0c0 5 7 11 7 11z"/><circle cx="12" cy="10" r="2.6"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    arrowUp: '<path d="M12 19V5M6 11l6-6 6 6"/>',
    spark: '<path d="M12 3l2.2 5.8L20 11l-5.8 2.2L12 19l-2.2-5.8L4 11l5.8-2.2L12 3z"/>',
    doc: '<path d="M14 3H6v18h12V7l-4-4z"/><path d="M14 3v4h4M9 13h6M9 17h4"/>',
    image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/>'
  };

  function icon(name, cls) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" ' +
      'stroke-linecap="round" stroke-linejoin="round"' + (cls ? ' class="' + cls + '"' : '') + '>' +
      (ICONS[name] || ICONS.check) + '</svg>';
  }

  /* ---------------- 取值工具：按 "company.phone" 这样的路径取值 ---------------- */
  function get(path) {
    return path.split(".").reduce(function (o, k) {
      return (o && o[k] !== undefined) ? o[k] : "";
    }, S);
  }

  /* ---------------- 1. 文本填充：[data-site="company.phone"] ---------------- */
  function fillText() {
    document.querySelectorAll("[data-site]").forEach(function (el) {
      var v = get(el.getAttribute("data-site"));
      if (v === "" || v === undefined) { el.style.display = "none"; return; }
      el.textContent = v;
    });
    // 拨号与邮件链接
    document.querySelectorAll("[data-tel]").forEach(function (el) {
      el.setAttribute("href", "tel:" + (S.company.phoneRaw || ""));
    });
    document.querySelectorAll("[data-mail]").forEach(function (el) {
      el.setAttribute("href", "mailto:" + (S.company.email || ""));
    });
    // 版权年份
    document.querySelectorAll("[data-year]").forEach(function (el) {
      el.textContent = new Date().getFullYear();
    });
  }

  /* ---------------- 2. 导航（桌面 + 移动抽屉） ---------------- */
  function renderNav() {
    var nav = S.nav || [];
    var page = (location.pathname.split("/").pop() || "index.html");
    if (page === "") page = "index.html";

    var navBox = document.querySelector("[data-nav]");
    if (navBox) {
      navBox.innerHTML = nav.map(function (n) {
        var on = n.href === page ? ' class="active"' : "";
        return '<li><a href="' + n.href + '"' + on + '>' + n.text + "</a></li>";
      }).join("");
    }
    var drawer = document.querySelector("[data-nav-mobile]");
    if (drawer) {
      drawer.innerHTML = nav.map(function (n) {
        return '<a href="' + n.href + '">' + n.text + "</a>";
      }).join("");
    }
  }

  /* ---------------- 3. 各板块渲染 ---------------- */
  function render() {
    // 数据条
    var st = document.querySelector('[data-render="stats"]');
    if (st) {
      st.innerHTML = (S.stats || []).map(function (s) {
        return '<div class="stat"><b data-count="' + s.num + '">0<i>' + s.unit + "</i></b>" +
          "<span>" + s.label + "</span></div>";
      }).join("");
    }

    // 服务卡片（首页）
    var sv = document.querySelector('[data-render="services"]');
    if (sv) {
      sv.innerHTML = (S.services || []).map(function (s) {
        return '<article class="card reveal">' +
          '<div class="ic">' + icon(s.icon) + "</div>" +
          "<h3>" + s.title + "</h3><p>" + s.desc + "</p>" +
          '<div class="tags">' + (s.tags || []).map(function (t) { return "<span>" + t + "</span>"; }).join("") + "</div>" +
          '<div class="more"><a class="textlink" href="service.html?s=' + (s.slug || "") + '">查看详情 ' + icon("arrow") + "</a></div>" +
          "</article>";
      }).join("");
    }

    // 服务列表（服务页）
    var svf = document.querySelector('[data-render="services-full"]');
    if (svf) {
      svf.innerHTML = (S.services || []).map(function (s, i) {
        return '<div class="svc-row reveal">' +
          '<div class="ic">' + icon(s.icon) + "</div>" +
          "<div><h3>" + s.title + "</h3><p>" + s.desc + "</p>" +
          '<div class="chips">' + (s.tags || []).map(function (t) { return "<span>" + t + "</span>"; }).join("") + "</div></div>" +
          '<div class="more"><a class="btn btn--line btn--sm" href="service.html?s=' + (s.slug || "") + '">查看详情</a></div>' +
          "</div>";
      }).join("");
    }

    // 优势
    var adv = document.querySelector('[data-render="advantages"]');
    if (adv) {
      adv.innerHTML = (S.advantages || []).map(function (a, i) {
        return '<div class="feat reveal"><div class="num">0' + (i + 1) + "</div>" +
          "<div><h4>" + a.title + "</h4><p>" + a.desc + "</p></div></div>";
      }).join("");
    }

    // 流程
    var pr = document.querySelector('[data-render="process"]');
    if (pr) {
      pr.innerHTML = (S.process || []).map(function (p, i) {
        return '<div class="step reveal' + (i === 0 ? " done" : "") + '">' +
          '<div class="dot">0' + (i + 1) + "</div><h4>" + p.title + "</h4><p>" + p.desc + "</p></div>";
      }).join("");
    }

    // 新闻卡片
    function newsCard(n) {
      return '<article class="news-card reveal">' +
        '<a class="news-thumb" href="article.html?s=' + (n.slug || "") + '" aria-label="' + n.title + '">' +
        '<span class="tagp">' + n.tag + "</span>" +
        '<span class="ph">' + icon("image") + "</span></a>" +
        '<div class="news-body"><time>' + n.date + "</time>" +
        '<h3><a href="article.html?s=' + (n.slug || "") + '">' + n.title + "</a></h3><p>" + n.excerpt + "</p>" +
        '<a class="textlink" href="article.html?s=' + (n.slug || "") + '">阅读全文 ' + icon("arrow") + "</a></div></article>";
    }
    var nw = document.querySelector('[data-render="news"]');
    if (nw) nw.innerHTML = (S.news || []).slice(0, 3).map(newsCard).join("");
    var nwa = document.querySelector('[data-render="news-all"]');
    if (nwa) nwa.innerHTML = (S.news || []).map(newsCard).join("");

    // 发展历程
    var ms = document.querySelector('[data-render="milestones"]');
    if (ms) {
      ms.innerHTML = (S.milestones || []).map(function (m) {
        return "<li><time>" + m.year + "</time><h4>" + m.title + "</h4><p>" + m.desc + "</p></li>";
      }).join("");
    }

    // 团队
    var tm = document.querySelector('[data-render="team"]');
    if (tm) {
      tm.innerHTML = (S.team || []).map(function (t) {
        return '<div class="team-card reveal"><div class="avatar">' + t.initial + "</div>" +
          "<h4>" + t.name + "</h4><span>" + t.role + "</span></div>";
      }).join("");
    }

    // 页脚服务链接
    var fl = document.querySelector('[data-render="footer-services"]');
    if (fl) {
      fl.innerHTML = (S.services || []).slice(0, 5).map(function (s) {
        return '<li><a href="service.html?s=' + (s.slug || "") + '">' + s.title + "</a></li>";
      }).join("");
    }
  }

  /* ---------------- 3.5 悬浮工具条（电话 / 微信 / 留言 / 回到顶部） ---------------- */
  function buildSideTools() {
    if (document.querySelector(".side-tools")) return;
    var QR_ICON = '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zM20 14h1M14 20h1M18 18h3v3h-3z"/>';
    var box = document.createElement("div");
    box.className = "side-tools";
    box.innerHTML =
      '<a href="tel:' + (S.company.phoneRaw || "") + '" aria-label="电话咨询">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' + ICONS.phone + '</svg>' +
        '<span class="st-tip">' + (S.company.phone || "电话咨询") + "</span></a>" +
      '<button type="button" data-wechat aria-label="添加微信">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' + QR_ICON + '</svg>' +
        '<span class="st-tip">添加微信</span>' +
        '<span class="qr-pop"><img src="assets/img/wechat-qr.png?v=2026110426" alt="微信二维码">' +
        '<b>扫码添加顾问微信</b><i>或拨打 ' + (S.company.phone || "") + '</i></span></button>' +
      '<a href="contact.html" data-msg aria-label="留言咨询">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.4 8.4 0 01-9 8.4 9.6 9.6 0 01-3.4-.6L3 21l1.7-4.6A8.4 8.4 0 1121 11.5z"/></svg>' +
        '<span class="st-tip">留言 / 询价</span></a>' +
      '<button type="button" data-to-top aria-label="回到顶部">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' + ICONS.arrowUp + '</svg>' +
        '<span class="st-tip">回到顶部</span></button>';
    document.body.appendChild(box);
    box.querySelector("[data-to-top]").addEventListener("click", function () {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
    /* 微信：弹出二维码卡片，点别处关闭 */
    var wxBtn = box.querySelector("[data-wechat]");
    wxBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      wxBtn.classList.toggle("qr-open");
    });
    document.addEventListener("click", function (e) {
      if (!wxBtn.contains(e.target)) wxBtn.classList.remove("qr-open");
    });
    /* 留言：已在联系页时不再重新加载，直接滚到表单 */
    var msgBtn = box.querySelector("[data-msg]");
    msgBtn.addEventListener("click", function (e) {
      if (!/contact\.html$/.test(location.pathname)) return;
      e.preventDefault();
      var form = document.querySelector("[data-contact-form]") || document.body;
      form.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }

  /* ---------------- 4. 交互：滚动阴影 / 移动菜单 ---------------- */
  function bindUI() {
    var header = document.querySelector(".header");
    if (header) {
      var onScroll = function () {
        header.classList.toggle("is-scrolled", window.scrollY > 8);
      };
      onScroll();
      window.addEventListener("scroll", onScroll, { passive: true });
    }

    var burger = document.querySelector(".burger");
    if (burger) {
      burger.addEventListener("click", function () {
        document.body.classList.toggle("menu-open");
      });
    }
    document.querySelectorAll("[data-nav-mobile] a").forEach(function (a) {
      a.addEventListener("click", function () { document.body.classList.remove("menu-open"); });
    });

    // 新闻分类筛选
    var bar = document.querySelector("[data-news-filter]");
    if (bar) {
      bar.addEventListener("click", function (e) {
        var btn = e.target.closest("button");
        if (!btn) return;
        bar.querySelectorAll("button").forEach(function (b) { b.classList.remove("on"); });
        btn.classList.add("on");
        var key = btn.getAttribute("data-tag");
        document.querySelectorAll("[data-render='news-all'] .news-card").forEach(function (c) {
          var tag = c.querySelector(".tagp");
          c.style.display = (!key || key === "全部" || (tag && tag.textContent === key)) ? "" : "none";
        });
      });
    }

    // 从项目详情页跳转过来时，自动选中对应项目
    var projSel = document.querySelector("[name=project]");
    if (projSel) {
      var map = { grs: "GRS", iscc: "ISCC", ecovadis: "EcoVadis", bsci: "BSCI", iso: "ISO", lean: "其他" };
      var key = new URLSearchParams(location.search).get("p");
      var want = key && map[key.toLowerCase()];
      if (want) {
        Array.prototype.forEach.call(projSel.options, function (o) {
          if (o.text.indexOf(want) === 0 || o.text.indexOf(want) > -1) projSel.value = o.value || o.text;
        });
      }
    }

    // 表单：优先写数据库（db.js 已连接时），否则本地演示提示
    var form = document.querySelector("[data-contact-form]");
    if (form) {
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        var name = (form.querySelector("[name=name]") || {}).value || "";
        var tel = (form.querySelector("[name=phone]") || {}).value || "";
        if (!name.trim() || !tel.trim()) {
          alert("请填写称呼和联系电话，方便我们回电。");
          return;
        }
        var msg = document.querySelector(".form-msg");
        if (window.DB && window.DB.ok() && window.DB.saveMessage) {
          var text = ((form.querySelector("[name=msg]") || {}).value || "") +
            (((form.querySelector("[name=company]") || {}).value) ? "（公司：" + form.querySelector("[name=company]").value + "）" : "") +
            (((form.querySelector("[name=project]") || {}).value) ? "（咨询：" + form.querySelector("[name=project]").value + "）" : "") +
            (((form.querySelector("[name=industry]") || {}).value) ? "（行业：" + form.querySelector("[name=industry]").value + "）" : "") +
            (((form.querySelector("[name=staff]") || {}).value) ? "（人数：" + form.querySelector("[name=staff]").value + "）" : "");
          window.DB.saveMessage({
            name: name.trim(), phone: tel.trim(),
            content: text.trim(), source: "联系页表单"
          }).then(function (res) {
            if (res && res.error) throw res.error;
            if (msg) { msg.textContent = "提交成功，我们会尽快与您联系！"; msg.classList.add("show"); }
            form.reset();
          }).catch(function (e) {
            if (msg) {
              var code = (e && (e.code || e.message)) || "网络异常";
              msg.textContent = "提交失败（" + String(code).slice(0, 40) + "），请直接拨打 " + (S.company.phone || "咨询热线") + "。";
              msg.classList.add("show");
            }
          });
          return;
        }
        if (msg) {
          msg.textContent = "提交成功（演示）：正式上线后请按 README 接入邮件或表单服务，当前为本地提示。";
          msg.classList.add("show");
        }
        form.reset();
      });
    }
  }

  /* ---------------- 5. 滚动出现 + 数字滚动 ---------------- */
  function bindMotion() {
    var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    var items = document.querySelectorAll(".reveal");
    if (!("IntersectionObserver" in window) || reduce) {
      items.forEach(function (el) { el.classList.add("in"); });
    } else {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) {
            var el = en.target;
            el.classList.add("in");
            // 动画结束后清掉延迟，避免影响卡片 hover 的过渡手感
            setTimeout(function () { el.style.transitionDelay = ""; }, 900);
            io.unobserve(el);
          }
        });
      }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
      items.forEach(function (el, i) {
        el.style.transitionDelay = (Math.min(i % 4, 3) * 70) + "ms";
        io.observe(el);
      });
    }

    // 数字递增
    var counters = document.querySelectorAll("[data-count]");
    if (!counters.length) return;
    var run = function (el) {
      var target = parseInt(el.getAttribute("data-count"), 10) || 0;
      var unitEl = el.querySelector("i");
      if (reduce) { el.innerHTML = target + (unitEl ? unitEl.outerHTML : ""); return; }
      var start = performance.now(), dur = 1100;
      var tick = function (now) {
        var p = Math.min((now - start) / dur, 1);
        var val = Math.round(target * (1 - Math.pow(1 - p, 3)));
        el.innerHTML = val + (unitEl ? unitEl.outerHTML : "");
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    };
    if (!("IntersectionObserver" in window)) { counters.forEach(run); return; }
    var co = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { run(en.target); co.unobserve(en.target); }
      });
    }, { threshold: 0.5 });
    counters.forEach(function (el) { co.observe(el); });
  }

  /* ---------------- 启动 ---------------- */
  function init() {
    fillText();
    renderNav();
    render();
    bindUI();
    bindMotion();
    buildSideTools();
    // 顶部信息条 / 页脚的联系方式图标
    document.querySelectorAll("[data-icon]").forEach(function (el) {
      el.innerHTML = icon(el.getAttribute("data-icon"));
    });
  }

  /* db.js 配置了数据库时，先等数据库内容合并完成再渲染 */
  Promise.resolve(window.__dbGate || null).catch(function () {}).then(function () {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", init);
    } else {
      init();
    }
  });
})();
