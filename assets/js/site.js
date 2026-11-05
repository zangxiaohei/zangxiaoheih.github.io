/* ==========================================================================
   站点脚本：负责把 assets/data/site.js 里的内容渲染到页面上
   一般不需要修改这个文件（除非你要加新的板块）
   ========================================================================== */
(function () {
  "use strict";

  var S = window.SITE || {};
  /* 双语：L("中文", "English") */
  var L = function (zh, en) { return (window.LANG === "en" && en) ? en : zh; };

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
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

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
          '<div class="more"><a class="textlink" href="service.html?s=' + (s.slug || "") + '">' + L("查看详情 ", "View details ") + icon("arrow") + "</a></div>" +
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
          '<div class="more"><a class="btn btn--line btn--sm" href="service.html?s=' + (s.slug || "") + '">' + L("查看详情", "View details") + '</a></div>' +
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
        '<a class="textlink" href="article.html?s=' + (n.slug || "") + '">' + L("阅读全文 ", "Read more ") + icon("arrow") + "</a></div></article>";
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

    // 客户墙（首页）
    var cl = document.querySelector('[data-render="clients"]');
    if (cl) {
      cl.innerHTML = (S.clients || []).map(function (c) {
        return '<div class="client-card reveal"><b>' + c.name + "</b>" + (c.en ? "<small>" + c.en + "</small>" : "") + "</div>";
      }).join("");
    }

    // 三大服务卡（首页）
    var bs = document.querySelector('[data-render="big-services"]');
    if (bs) {
      bs.innerHTML = (S.bigServices || []).map(function (s) {
        return '<div class="bs-card reveal">' +
          '<div class="ic">' + icon(s.icon) + "</div>" +
          "<h3>" + s.title + "</h3><p>" + s.desc + "</p>" +
          '<a class="btn btn--line btn--sm" href="contact.html">' + L("立即咨询", "Enquire now") + "</a></div>";
      }).join("");
    }

    // 认证项目分类 Tab（首页）
    var cc = document.querySelector('[data-render="cert-cats"]');
    if (cc) {
      var cats = S.certCats || [];
      var tabs = cats.map(function (c, i) {
        return '<button class="tab' + (i === 0 ? " on" : "") + '" data-cat="' + i + '">' + c.name + "</button>";
      }).join("");
      var panels = cats.map(function (c, i) {
        return '<div class="tab-panel' + (i === 0 ? " on" : "") + '" data-panel="' + i + '">' +
          c.items.map(function (it) {
            return '<a class="cert-card reveal" href="services.html">' +
              '<span class="cc-logo" style="color:' + it.color + '">' + it.abbr + "</span>" +
              "<b>" + it.title + "</b>" +
              '<span class="more-link">' + L("查看更多 &gt;&gt;", "View more &gt;&gt;") + "</span></a>";
          }).join("") + "</div>";
      }).join("");
      cc.innerHTML = '<div class="tab-bar">' + tabs + '<a class="tab-more" href="services.html">' + L("查看更多", "View all") + " " + icon("arrow") + "</a></div>" + panels;
      cc.addEventListener("click", function (e) {
        var t = e.target.closest("[data-cat]");
        if (!t) return;
        cc.querySelectorAll(".tab").forEach(function (x) { x.classList.toggle("on", x === t); });
        var idx = t.getAttribute("data-cat");
        cc.querySelectorAll(".tab-panel").forEach(function (p) { p.classList.toggle("on", p.getAttribute("data-panel") === idx); });
        bindMotion();
      });
    }

    // 选择对比表（首页）
    var cp = document.querySelector('[data-render="compare"]');
    if (cp && S.compare) {
      var rowsHtml = (S.compare.rows || []).map(function (r, i) {
        return '<div class="cmp-row' + (i % 2 ? " alt" : "") + '">' +
          '<div class="cmp-k">' + r.k + "</div>" +
          '<div class="cmp-ours"><span class="ok">' + icon("check") + "</span>" + r.ours + "</div>" +
          '<div class="cmp-theirs"><span class="no">' + icon("doc") + "</span>" + r.theirs + "</div></div>";
      }).join("");
      cp.innerHTML = '<div class="cmp-head"><div class="cmp-k"></div>' +
        '<div class="cmp-ours cmp-title"><span class="ok">' + icon("shield") + "</span>" + L("中天顾问团队", "Zenithe consultants") + "</div>" +
        '<div class="cmp-theirs cmp-title dim"><span class="no">' + icon("doc") + "</span>" + L("一般咨询公司", "Typical consultancies") + "</div></div>" + rowsHtml;
    }

    // 六步合作流程（首页）
    var s6 = document.querySelector('[data-render="steps6"]');
    if (s6) {
      s6.innerHTML = (S.steps6 || []).map(function (p, i) {
        return '<div class="flow-step reveal"><span class="fnum">0' + (i + 1) + "</span><b>" + p.title + "</b><small>" + p.desc + "</small></div>";
      }).join("");
    }

    // 关于板块资质列表（首页）
    var ac = document.querySelector('[data-render="about-certs"]');
    if (ac) {
      ac.innerHTML = (S.aboutCerts || []).map(function (t, i) {
        return "<li><i>" + (i + 1) + ".</i>" + t + "</li>";
      }).join("");
    }

    // 侧栏：更多服务 + 成功案例推荐（about 页）
    var ms2 = document.querySelector('[data-render="more-services"]');
    if (ms2) {
      ms2.innerHTML = (S.moreServices || []).map(function (x) {
        return '<li><a href="' + x.href + '">' + esc(x.name) + "</a></li>";
      }).join("");
    }
    var sc2 = document.querySelector('[data-render="side-cases"]');
    if (sc2) {
      sc2.innerHTML = (S.cases || []).slice(0, 3).map(function (c) {
        return '<div class="sb-case"><a href="cases.html"><b>' + esc(c.title) +
          "</b><small>" + esc(c.industry) + " · " + esc((c.metrics && c.metrics[2] && c.metrics[2].v) || "") + "</small></a></div>";
      }).join("");
    }

    // 底部特色条
    var wt = document.querySelector('[data-render="waiter"]');
    if (wt) {
      wt.innerHTML = (S.waiter || []).map(function (w) {
        return '<div class="w-item"><div><b>' + w.k + "</b><small>" + w.v + "</small></div></div>";
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
      '<a href="tel:' + (S.company.phoneRaw || "") + '" aria-label="' + L("电话咨询", "Call us") + '">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' + ICONS.phone + '</svg>' +
        '<span class="st-tip">' + (S.company.phone || L("电话咨询", "Call us")) + "</span></a>" +
      '<button type="button" data-wechat aria-label="' + L("添加微信", "WeChat") + '">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' + QR_ICON + '</svg>' +
        '<span class="st-tip">' + L("添加微信", "WeChat") + '</span>' +
        '<span class="qr-pop"><img src="assets/img/wechat-qr.png?v=2026110427" alt="' + L("微信二维码", "WeChat QR code") + '">' +
        '<b>' + L("扫码添加顾问微信", "Scan to add our consultant") + '</b><i>' + L("或拨打 ", "or call ") + (S.company.phone || "") + '</i></span></button>' +
      '<a href="contact.html" data-msg aria-label="' + L("留言咨询", "Message us") + '">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.4 8.4 0 01-9 8.4 9.6 9.6 0 01-3.4-.6L3 21l1.7-4.6A8.4 8.4 0 1121 11.5z"/></svg>' +
        '<span class="st-tip">' + L("留言 / 询价", "Message / quote") + '</span></a>' +
      '<button type="button" data-to-top aria-label="' + L("回到顶部", "Back to top") + '">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' + ICONS.arrowUp + '</svg>' +
        '<span class="st-tip">' + L("回到顶部", "Back to top") + '</span></button>';
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
      /* 以“GET IN TOUCH / 直接联系我们”标题为锚点，紧贴页头下方约10px */
      var grid = document.querySelector(".contact-grid");
      var anchor = grid ? (grid.querySelector(".eyebrow") || grid) : document.querySelector("[data-contact-form]") || document.body;
      var headH = (document.querySelector(".header") || {}).offsetHeight || 0;
      var top = anchor.getBoundingClientRect().top + window.pageYOffset - headH - 10;
      window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
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
          alert(L("请填写称呼和联系电话，方便我们回电。", "Please fill in your name and phone number so we can call you back."));
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
            content: text.trim(), source: L("联系页表单", "Contact form")
          }).then(function (res) {
            if (res && res.error) throw res.error;
            if (msg) { msg.textContent = L("提交成功，我们会尽快与您联系！", "Sent — we will contact you shortly."); msg.classList.add("show"); }
            form.reset();
          }).catch(function (e) {
            if (msg) {
              var code = (e && (e.code || e.message)) || L("网络异常", "Network error");
              msg.textContent = L("提交失败（" + String(code).slice(0, 40) + "），请直接拨打 " + (S.company.phone || "咨询热线") + "。",
                                  "Submission failed (" + String(code).slice(0, 40) + "). Please call " + (S.company.phone || "our hotline") + ".");
              msg.classList.add("show");
            }
          });
          return;
        }
        if (msg) {
          msg.textContent = L("提交成功（演示）：正式上线后请按 README 接入邮件或表单服务，当前为本地提示。",
                              "Sent (demo): connect your email or form service before going live — this is a local message only.");
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
  /* Hero 标语轮播 */
  function heroSlider() {
    var slides = document.querySelectorAll(".hero-slide");
    var dotsBox = document.getElementById("heroDots");
    if (slides.length < 2 || !dotsBox) return;
    var idx = 0, timer = null;
    slides.forEach(function (s, i) {
      var b = document.createElement("button");
      b.setAttribute("aria-label", "第" + (i + 1) + "张");
      if (i === 0) b.classList.add("on");
      b.addEventListener("click", function () { go(i); restart(); });
      dotsBox.appendChild(b);
    });
    var dots = dotsBox.querySelectorAll("button");
    function go(i) {
      idx = (i + slides.length) % slides.length;
      slides.forEach(function (s, k) { s.classList.toggle("on", k === idx); });
      dots.forEach(function (d, k) { d.classList.toggle("on", k === idx); });
    }
    function restart() { if (timer) clearInterval(timer); timer = setInterval(function () { go(idx + 1); }, 5200); }
    restart();
  }

  function init() {
    fillText();
    renderNav();
    render();
    bindUI();
    bindMotion();
    buildSideTools();
    heroSlider();
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
