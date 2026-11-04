/* ==========================================================================
   详情页渲染：service.html（项目详情）/ article.html（新闻正文）/ cases.html（案例）
   数据全部来自 assets/data/site.js，改内容不需要动这个文件
   ========================================================================== */
(function () {
  "use strict";
  var S = window.SITE || {};
  var page = document.body.getAttribute("data-page");
  var qs = new URLSearchParams(location.search);
  var V = "v=2026110406";  /* 资源版本号：改 JS/CSS 后需同步升级各页面的 ?v= */

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function setText(sel, v) {
    document.querySelectorAll('[data-dt="' + sel + '"]').forEach(function (el) { el.textContent = v || ""; });
  }

  /* ---------------- 项目详情 ---------------- */
  function renderService() {
    var list = S.services || [];
    var s = list.filter(function (x) { return x.slug === qs.get("s"); })[0] || list[0];
    if (!s) return;

    document.title = s.title + " | " + (S.company.name || "");
    var desc = document.querySelector('meta[name="description"]');
    if (desc) desc.setAttribute("content", s.desc || "");
    var can = document.querySelector('link[rel="canonical"]');
    if (can) can.setAttribute("href", location.origin + location.pathname + "?s=" + s.slug);

    setText("title", s.title);
    setText("desc", s.desc);
    setText("intro", s.intro || s.desc);
    setText("cycle", s.cycle || "以诊断结论为准");

    var tags = document.querySelector('[data-dt="tags"]');
    if (tags) tags.innerHTML = (s.tags || []).map(function (t) { return "<span>" + esc(t) + "</span>"; }).join("");

    var fit = document.querySelector('[data-dt="fit"]');
    if (fit) fit.innerHTML = (s.fit || []).map(function (t) { return "<li>" + esc(t) + "</li>"; }).join("");

    var docs = document.querySelector('[data-dt="docs"]');
    if (docs) docs.innerHTML = (s.docs || []).map(function (t) {
      return '<li><span class="doc-ck"></span>' + esc(t) + "</li>";
    }).join("");

    var faq = document.querySelector('[data-dt="faqs"]');
    if (faq) {
      faq.innerHTML = (s.faqs || []).map(function (f, i) {
        return '<details class="faq-item"' + (i === 0 ? " open" : "") + "><summary>" + esc(f.q) +
          "</summary><p>" + esc(f.a) + "</p></details>";
      }).join("");
    }

    /* 右侧栏：其他项目 */
    var others = document.querySelector('[data-dt="others"]');
    if (others) {
      others.innerHTML = list.filter(function (x) { return x.slug !== s.slug; }).map(function (x) {
        return '<li><a href="service.html?s=' + x.slug + '">' + esc(x.title) + "<i>→</i></a></li>";
      }).join("");
    }

    /* 站内 CTA 带上项目参数，联系页自动选中对应项目 */
    document.querySelectorAll('a[href="contact.html"]').forEach(function (a) {
      a.setAttribute("href", "contact.html?p=" + s.slug);
    });

    /* 结构化数据：FAQ + 面包屑 */
    var ld = document.createElement("script");
    ld.type = "application/ld+json";
    ld.textContent = JSON.stringify([{
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "mainEntity": (s.faqs || []).map(function (f) {
        return { "@type": "Question", "name": f.q, "acceptedAnswer": { "@type": "Answer", "text": f.a } };
      })
    }, {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "首页", "item": location.origin + "/" },
        { "@type": "ListItem", "position": 2, "name": "认证项目", "item": location.origin + "/services.html" },
        { "@type": "ListItem", "position": 3, "name": s.title }
      ]
    }]);
    document.head.appendChild(ld);
  }

  /* ---------------- 新闻正文 ---------------- */
  function renderArticle() {
    var list = S.news || [];
    var n = list.filter(function (x) { return x.slug === qs.get("s"); })[0] || list[0];
    if (!n) return;

    document.title = n.title + " | " + (S.company.name || "");
    var desc = document.querySelector('meta[name="description"]');
    if (desc) desc.setAttribute("content", n.excerpt || "");

    setText("title", n.title);
    setText("meta", n.date + " · " + n.tag + " · " + (S.company.name || ""));

    var body = document.querySelector('[data-dt="body"]');
    if (body) {
      var html = '<p class="lead">' + esc(n.excerpt) + "</p>";
      html += (n.body || []).map(function (b) {
        if (typeof b === "string") return "<p>" + esc(b) + "</p>";
        return (b.h ? "<h2>" + esc(b.h) + "</h2>" : "") + "<p>" + esc(b.p) + "</p>";
      }).join("");
      body.innerHTML = html;
    }

    var more = document.querySelector('[data-dt="more"]');
    if (more) {
      more.innerHTML = list.filter(function (x) { return x.slug !== n.slug; }).slice(0, 3).map(function (x) {
        return '<a class="more-item" href="article.html?s=' + x.slug + '"><time>' + x.date +
          "</time><b>" + esc(x.title) + "</b></a>";
      }).join("");
    }
  }

  /* ---------------- 案例列表 ---------------- */
  function renderCases() {
    var box = document.querySelector('[data-render="cases"]');
    if (!box) return;
    var all = S.cases || [];
    var inds = ["全部"].concat(all.map(function (c) { return c.industry; }).filter(function (v, i, a) { return a.indexOf(v) === i; }));

    var bar = document.querySelector("[data-case-filter]");
    if (bar) {
      bar.innerHTML = inds.map(function (t, i) {
        return '<button data-ind="' + esc(t) + '"' + (i === 0 ? ' class="on"' : "") + ">" + esc(t) + "</button>";
      }).join("");
      bar.addEventListener("click", function (e) {
        var b = e.target.closest("button");
        if (!b) return;
        bar.querySelectorAll("button").forEach(function (x) { x.classList.remove("on"); });
        b.classList.add("on");
        var key = b.getAttribute("data-ind");
        box.querySelectorAll(".case-card").forEach(function (c) {
          c.style.display = (key === "全部" || c.getAttribute("data-ind") === key) ? "" : "none";
        });
      });
    }

    box.innerHTML = all.map(function (c) {
      return '<article class="case-card reveal in" data-ind="' + esc(c.industry) + '">' +
        '<div class="case-top"><span class="case-tag">' + esc(c.industry) + "</span></div>" +
        "<h3>" + esc(c.title) + "</h3>" +
        '<dl class="case-dl">' +
        "<dt>问题</dt><dd>" + esc(c.situation) + "</dd>" +
        "<dt>我们做的</dt><dd>" + esc(c.action) + "</dd>" +
        "<dt>结果</dt><dd class=\"good\">" + esc(c.result) + "</dd></dl>" +
        '<div class="case-metrics">' + (c.metrics || []).map(function (m) {
          return '<span><b>' + esc(m.v) + "</b>" + esc(m.k) + "</span>";
        }).join("") + "</div></article>";
    }).join("");
  }

  function init() {
    if (page === "service") renderService();
    if (page === "article") renderArticle();
    if (page === "cases") renderCases();
  }

  Promise.resolve(window.__dbGate || null).catch(function () {}).then(function () {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
    else init();
  });
})();
