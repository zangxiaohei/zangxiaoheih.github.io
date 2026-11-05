/* ==========================================================================
   中英文切换（i18n）
   · 数据层：切到 EN 时用 assets/data/site.en.js 覆盖 SITE 里的对应字段
   · 界面层：把页面上的中文文本节点 / placeholder / aria-label 替换成英文
   · 切换方式：写 localStorage 后重载页面，保证渲染出来的内容全部换语言
   ========================================================================== */
(function () {
  "use strict";

  /* ---------------- 1. 当前语言 ---------------- */
  /* 优先级：网址参数 ?lang=en > 上次选择 > 默认中文 */
  var LANG = "zh";
  try {
    var q = (location.search.match(/[?&]lang=(en|zh)\b/) || [])[1];
    LANG = q || localStorage.getItem("zt_lang") || "zh";
  } catch (e) {}
  if (LANG !== "en") LANG = "zh";

  window.LANG = LANG;
  /* 供其它脚本使用：L("中文", "English") */
  window.L = function (zh, en) { return (LANG === "en" && en) ? en : zh; };

  if (LANG !== "en") {
    /* 中文模式：只需绑定切换按钮（等 DOM 就绪） */
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", bindLang);
    } else {
      bindLang();
    }
    return;
  }

  /* ---------------- 2. 数据层：英文覆盖 ---------------- */
  function isPlain(o) { return o && typeof o === "object" && !Array.isArray(o); }
  function merge(base, over) {
    if (Array.isArray(over)) return over;              /* 数组整体替换 */
    if (isPlain(over)) {
      var out = {};
      for (var k in base) out[k] = base[k];
      for (var k2 in over) out[k2] = isPlain(base[k2]) ? merge(base[k2], over[k2]) : over[k2];
      return out;
    }
    return over === undefined ? base : over;
  }
  if (window.SITE && window.SITE_EN) window.SITE = merge(window.SITE, window.SITE_EN);
  /* 供 db.js 在合并后台内容后重新套用英文（否则后台中文内容会覆盖英文数据） */
  window.__i18nApplyData = function () {
    if (window.SITE && window.SITE_EN) window.SITE = merge(window.SITE, window.SITE_EN);
  };

  /* ---------------- 3. 界面文案字典（中文原文 → English） ---------------- */
  var UI = {
    /* 页面标题（<title>） */
    "关于我们 | 中天技术服务": "About us | Zenithe",
    "认证项目 | 中天技术服务": "Services | Zenithe",
    "认证项目详情 | 中天技术服务": "Service detail | Zenithe",
    "新闻资讯 | 中天技术服务": "Insights | Zenithe",
    "资讯正文 | 中天技术服务": "Article | Zenithe",
    "客户案例 | 中天技术服务": "Case studies | Zenithe",
    "联系我们 | 中天技术服务": "Contact | Zenithe",

    /* 顶部 / 导航 / 页脚 */
    "深圳市中天技术服务有限公司 | GRS、ISCC、EcoVadis、BSCI 一站式认证辅导": "Shenzhen Zenithe Technical Service | One-stop GRS, ISCC, EcoVadis & BSCI consulting",
    "免费咨询热线": "Consultation hotline",
    "免费诊断": "Free assessment",
    "免费诊断 / 报价": "Free assessment / quote",
    "认证项目": "Services",
    "客户案例": "Case studies",
    "关于我们": "About us",
    "新闻资讯": "Insights",
    "联系我们": "Contact",
    "公司简介": "Company",
    "发展历程": "Milestones",
    "顾问团队": "Our team",
    "联系方式": "Get in touch",
    "首页": "Home",

    /* 首页 hero */
    "合规认证 · 一站式辅导": "Compliance · One-stop advisory",
    "把复杂的认证流程，": "Complex certification,",
    "交给": "handed to ",
    "真正懂审核": "people who know audits",
    "的人": "",
    "从 GRS、ISCC 到 EcoVadis、BSCI，我们不做文件搬运工。先诊断差距，再逐条整改，陪你把证书拿到手。": "From GRS and ISCC to EcoVadis and BSCI — we are not document movers. We diagnose the gaps first, remediate line by line, and stay with you until the certificate is issued.",
    "免费获取诊断方案": "Get a free assessment",
    "查看认证项目": "Explore services",
    "40+ 项认证覆盖": "40+ standards covered",
    "98% 一次性通过率": "98% first-time pass rate",
    "不通过按约定退费": "Refund per contract if we fail",
    "GRS 4.0 认证通过": "GRS 4.0 certified",
    "再生含量 52% · 已签发": "52% recycled content · Issued",
    "EcoVadis 银牌": "EcoVadis Silver",
    "综合评分 61 / 100": "Overall score 61 / 100",
    "TC 交易证书": "TC transaction certificate",
    "3 个工作日完成审核": "Reviewed in 3 working days",

    /* 首页各板块 */
    "覆盖出口企业最常被客户要求的认证": "The certifications your customers ask for most",
    "按行业与目标市场匹配标准，不推销你用不上的项目。": "We match standards to your industry and target market — and never sell you a scheme you don't need.",
    "查看全部认证项目": "View all services",

    /* 首页 · 权威认证徽标墙 */
    "权威资质 · 全球认可": "Accreditations · Globally recognized",
    "我们辅导交付的认证体系，覆盖欧盟、美国及主流品牌客户对供应链的合规要求。": "The schemes we deliver cover the supply-chain compliance requirements of the EU, the US and major brand customers.",
    "GRS 全球回收标准": "GRS – Global Recycled Standard",
    "ISCC 可持续碳认证": "ISCC – Sustainable carbon certification",
    "EcoVadis 企业评级": "EcoVadis business rating",
    "BSCI 社会责任验厂": "BSCI social compliance audit",
    "SLCP 社会劳工整合": "SLCP – Social & Labor Convergence",
    "Sedex / SMETA 验厂": "Sedex / SMETA audit",
    "ISO 9001 质量管理": "ISO 9001 Quality management",
    "ISO 14001 环境管理": "ISO 14001 Environmental management",
    "ISO 45001 职业健康": "ISO 45001 Occupational health & safety",
    "C-TPAT / SCAN 反恐": "C-TPAT / SCAN security",
    "不通过按约定退费": "Refund per contract if we fail",
    "退费条款白纸黑字写进合同，不做口头承诺。": "Refund terms are written into the contract — no verbal promises.",
    "审核背景顾问团队": "Consultants with audit backgrounds",
    "超三分之一顾问出自第三方审核机构。": "Over a third of our consultants come from third-party audit bodies.",
    "驻厂 + 远程双模式": "On-site + remote delivery",
    "顾问驻厂辅导，远程随时答疑响应。": "Consultants work at your plant and answer remotely any time.",
    "证书有效期全程维护": "Full maintenance while valid",
    "年审提醒、标准换版转换，全程托管。": "Surveillance reminders and standard transitions, fully managed.",
    "审核官看什么，我们就补什么": "We close exactly what the auditor looks at",
    "很多企业卡在同一个地方：文件写了一堆，现场一问就露馅。我们的顾问大多做过审核，知道问题会从哪问出来。": "Most companies get stuck in the same place: reams of documents that fall apart the moment an auditor asks a question on the floor. Most of our consultants have run audits themselves and know where the questions come from.",
    "合规成熟度评估": "Compliance maturity snapshot",
    "文件体系完备度": "Documentation completeness",
    "现场执行一致性": "Shop-floor consistency",
    "供应链追溯完整度": "Supply-chain traceability",
    "员工访谈准备度": "Interview readiness",
    "平均整改周期缩短": "Average remediation time cut",
    "约 30 个工作日": "by ~30 working days",
    "四步走，每一步都有交付物": "Four steps, a deliverable at every stage",
    "不做无期限的口头承诺，每个节点都有明确的产出和验收标准。": "No open-ended verbal promises — every milestone has a defined output and acceptance criterion.",
    "政策在变，别等客户来通知你": "Rules change. Don't wait for your customer to tell you.",
    "标准更新、审核趋势与真实案例，每月更新。": "Standard updates, audit trends and real cases, refreshed monthly.",
    "全部资讯": "All insights",
    "不确定自己该做哪个认证？": "Not sure which certification you need?",
    "把产品、客户要求和目标市场告诉我们，24 小时内给出一份适配方案与预算区间。": "Tell us your product, your customer's requirements and your target market. Within 24 hours you'll get a fit assessment and a budget range.",
    "提交需求": "Send enquiry",

    /* 关于我们 */
    "一家由审核出身的人组成的顾问团队，只做能落地的合规辅导。": "A team of consultants who came from auditing — we only do compliance work that actually holds up.",
    "我们更在意「审核当天不出问题」": "What matters to us is that nothing goes wrong on audit day",
    "公司成立于 2013 年，从社会责任验厂辅导起步。十余年间，团队服务过纺织、塑胶、五金、电子、包装等行业的 3600 多家制造企业。": "Founded in 2013, we started with social compliance audit support. Over the past decade the team has served more than 3,600 manufacturers across textiles, plastics, hardware, electronics and packaging.",
    "我们发现，企业真正需要的不是一套漂亮的文件，而是现场经得起问、数据经得起查、供应链经得起追溯。所以我们把工作重心放在「诊断」和「现场整改」两件事上，而不是替客户写材料。": "We found that what companies really need is not a handsome document set, but a shop floor that survives questions, data that survives scrutiny and a supply chain that can be traced. So we put our effort into diagnosis and on-site remediation — not into writing materials for you.",
    "目前团队有 40 余位全职顾问，其中超过三分之一有第三方审核或品牌方验厂背景。": "We now have more than 40 full-time consultants; over a third have worked as third-party auditors or in brand compliance teams.",
    "预约顾问沟通": "Book a call",
    "查看项目": "View services",
    "一步步走到今天": "How we got here",
    "没有资本故事，只有一个个项目积累下来的经验。": "No funding story — just experience accumulated project by project.",
    "项目由谁来做，比承诺更重要": "Who does the work matters more than what we promise",
    "签约时的顾问，就是全程跟进的顾问，不换人、不转包。": "The consultant who signs with you runs the project: no handovers, no subcontracting.",
    "想先聊聊你的具体情况？": "Want to talk through your situation first?",
    "电话沟通 15 分钟，通常就能判断需不需要做、大概要多久。": "A 15-minute call is usually enough to tell whether you need it and how long it will take.",
    "拨打": "Call",
    "在线留言": "Leave a message",

    /* 认证项目列表页 */
    "从社会责任到可持续发展，按你的客户要求与目标市场，选对标准、少走弯路。": "From social compliance to sustainability — pick the right standard for your customer and market, and skip the detours.",
    "我们能做的项目": "What we deliver",
    "每一类项目都包含「差距诊断 → 文件搭建 → 现场整改 → 审核陪审 → 证后维护」完整链路。": "Every engagement covers the full chain: gap diagnosis, documentation, on-site remediation, audit support and post-certification maintenance.",
    "客户最常问的四个问题": "Four questions we hear most",
    "做认证要多久？": "How long does certification take?",
    "体系类项目通常 2~3 个月，GRS / ISCC 约 4~8 周（含发证机构排期），EcoVadis 评级提升视差距项而定，一般 6~12 周。具体以诊断结论为准。": "ISO systems usually take 2–3 months; GRS and ISCC about 4–8 weeks including certification body scheduling; EcoVadis improvement depends on the gaps, typically 6–12 weeks. The diagnosis sets the final schedule.",
    "审核不通过怎么办？": "What if the audit fails?",
    "不符合项由我们负责闭环整改并安排跟进审核，直到取证。合同里会写明不通过的处理与退费条款，不做口头承诺。": "We close out non-conformities and arrange the follow-up audit until the certificate is issued. The contract states the handling and refund terms for a failed audit — no verbal promises.",
    "费用大概多少？": "What does it cost?",
    "由「辅导服务费 + 认证机构审核费」两部分组成，与人数、场地数量、认证范围相关。诊断后给到分项报价，不打包模糊收费。": "Two parts: our consulting fee plus the certification body's audit fee, driven by headcount, number of sites and scope. After diagnosis you receive an itemised quote — no lump-sum guesswork.",
    "证书到期了怎么维护？": "How is the certificate maintained?",
    "有效期内我们会提前 90 天提醒年审，协助准备监督审核资料；标准换版时提供转换方案，老客户不额外收诊断费。": "We remind you 90 days before the surveillance audit and help prepare the documents. When a standard is revised we provide a transition plan, with no extra diagnosis fee for existing clients.",
    "把客户的要求发给我们，先做一次免费诊断": "Send us your customer's requirements and start with a free assessment",
    "不需付费即可获得差距清单，判断哪些项目必须做、哪些可以先放一放。": "Get a gap list at no cost, so you can see which projects are essential and which can wait.",

    /* 项目详情页 */
    "项目详情": "Service detail",
    "项目概览": "Overview",
    "适合哪些企业": "Who it's for",
    "需要准备什么": "What you will need",
    "我们怎么做": "How we work",
    "01 差距诊断": "01 Gap diagnosis",
    "按标准条款逐项比对现状，输出差距清单、工作量与时间表，明确哪些必须改、哪些可以后置。": "A clause-by-clause comparison with your current state, delivering a gap list, workload and timeline that separate must-fix items from can-wait items.",
    "02 文件搭建": "02 Documentation",
    "把制度落到你的真实工序上，配套台账与记录模板，确保审核员问得出、员工答得上。": "Systems written onto your real processes, with ledgers and record templates an auditor can probe and your staff can answer.",
    "03 现场整改": "03 On-site remediation",
    "模拟审核官视角走线、查记录、访谈员工，问题项当场给整改动作与责任人。": "We walk the line, check records and interview workers as an auditor would, assigning the fix and the owner on the spot.",
    "04 审核与取证": "04 Audit and certification",
    "全程陪审、现场答疑、不符合项闭环跟踪，直到证书与 TC 到手。": "Full audit support, on-site clarification and closure tracking until the certificate and TCs are in hand.",
    "常见问题": "FAQ",
    "项目速览": "At a glance",
    "参考周期": "Typical duration",
    "服务方式": "Delivery",
    "驻厂 + 远程": "On-site + remote",
    "通过率": "Pass rate",
    "98%（近三年）": "98% (last three years)",
    "收费方式": "Pricing",
    "诊断后分项报价": "Itemised quote after diagnosis",
    "直接打电话咨询": "Call us directly",
    "看看其他项目": "Browse other services",
    "不确定要不要做？先做一次免费诊断": "Not sure it is worth it? Start with a free assessment",
    "把产品和客户要求告诉我们，48 小时内给到差距清单、周期与分项报价，不签约也照发。": "Tell us your product and customer requirements and within 48 hours you will have a gap list, timeline and itemised quote — whether or not you sign.",
    "立即预约诊断": "Book an assessment",
    "问题": "Situation",
    "我们做的": "What we did",
    "结果": "Result",
    "以诊断结论为准": "Confirmed at diagnosis",

    /* 新闻 / 正文 */
    "标准更新、审核趋势、真实案例——每一条都和你的订单有关。": "Standard updates, audit trends and real cases — each one tied to your orders.",
    "全部": "All",
    "政策解读": "Policy",
    "行业观察": "Industry",
    "公司动态": "Company news",
    "（示例内容。正式使用时，把站点接入后台或按 README 的方式在 site.js 里增删即可。）": "(Sample content. To publish, connect the CMS or add and remove items in site.js as described in the README.)",
    "想第一时间收到标准更新提醒？": "Want standard updates as they happen?",
    "留下邮箱，我们会把影响你所在行业的变化整理成一页纸发给你。": "Leave your email and we will send a one-page summary of the changes affecting your industry.",
    "留下联系方式": "Leave your details",
    "正文": "Article",
    "继续阅读": "Keep reading",
    "← 返回全部资讯": "← Back to all insights",
    "这些变化对你的项目有什么影响？": "How do these changes affect your project?",
    "留下产品与客户要求，我们按你的实际情况判断，不套模板结论。": "Tell us your product and customer requirements — we judge on your actual situation, not on a template.",
    "咨询我们的顾问": "Talk to a consultant",

    /* 案例页 */
    "真实项目的过程与结果：问题出在哪、我们做了什么、最后拿到什么。行业与项目名已做匿名处理。": "Real projects: what went wrong, what we did, what the client got. Company and project names are anonymised.",
    "你的情况可能和上面某一个很像": "Your situation may look like one of these",
    "说说你的产品、客户要求与时间节点，我们先判断难度与可行性，再谈合作。": "Tell us your product, customer requirements and deadlines. We assess difficulty and feasibility first, then discuss working together.",
    "聊聊我的项目": "Discuss my project",

    /* 联系页 */
    "留下需求，工作时间内 2 小时响应，24 小时内给出初步建议。": "Leave your requirements — we respond within 2 business hours and give initial advice within 24.",
    "直接联系我们": "Reach us directly",
    "电话最快，微信次之，表单适合把细节一次说清。": "Phone is fastest, WeChat next; the form is best when you want to explain everything at once.",
    "咨询热线": "Hotline",
    "商务邮箱": "Email",
    "公司地址": "Address",
    "工作时间": "Business hours",
    "告诉我们你的需求": "Tell us what you need",
    "称呼": "Name",
    "联系电话": "Phone",
    "公司名称": "Company",
    "想咨询的项目": "Service of interest",
    "请选择（选填）": "Please select (optional)",
    "GRS 全球回收标准": "GRS – Global Recycled Standard",
    "ISCC 可持续认证": "ISCC Sustainability",
    "EcoVadis 评级提升": "EcoVadis Rating Improvement",
    "BSCI / SLCP 社会责任": "BSCI / SLCP Social Compliance",
    "ISO 质量 / 环境 / 职业健康": "ISO Quality / Environment / OH&S",
    "其他 / 不确定": "Other / Not sure",
    "所属行业": "Industry",
    "纺织 / 服装 / 家纺": "Textiles / Apparel / Home textiles",
    "塑料 / 包装": "Plastics / Packaging",
    "电子 / 电气": "Electronics / Electrical",
    "化工 / 新材料": "Chemicals / New materials",
    "贸易 / 外贸公司": "Trading / Export",
    "其他": "Other",
    "员工人数": "Employees",
    "50 人以下": "Under 50",
    "50~200 人": "50–200",
    "200~500 人": "200–500",
    "500~1000 人": "500–1000",
    "1000 人以上": "1000+",
    "需求描述": "Your requirement",
    "提交后我们会收到通知，工作日 2 小时内回复。你的信息仅用于项目沟通，不会对外提供。": "We are notified as soon as you submit and reply within 2 business hours. Your details are used only for this enquiry and never shared.",
    "地图占位区": "Map placeholder",
    "正式上线时把这里换成百度地图 / 高德地图的嵌入代码（<iframe>），替换掉整段 .map-box 即可。": "Replace this block with a Baidu or AMap embed when the site goes live — swap out the whole .map-box element.",
    "地铁": "Metro",
    "2 号线 C 出口步行 400 米，A 座大堂乘电梯至 18 楼。": "Exit C of Line 2, a 400 m walk; take the lift in Tower A to the 18th floor.",
    "自驾": "By car",
    "导航「国际商务中心」，地下 B2 有访客车位，登记后可免费停车 2 小时。": "Navigate to International Business Center; visitor parking is on B2, free for 2 hours after registration.",
    "上门前请先预约": "Please book before visiting",
    "顾问常驻客户现场，提前一天电话确认，避免白跑。": "Our consultants are usually at client sites — call one day ahead to avoid a wasted trip.",

    /* 悬浮工具条 / 聊天组件（chat.js 动态生成，靠监听器翻译） */
    "电话咨询": "Call us",
    "微信": "WeChat",
    "留言": "Message",
    "留言 / 询价": "Message / quote",
    "回到顶部": "Back to top",
    "扫码添加顾问微信": "Scan to add our consultant",
    "或拨打": "or call",
    "在线客服": "Online support",
    "在线咨询": "Chat now",
    "查看详情": "View details",
    "阅读全文": "Read more",
    "微信二维码": "WeChat QR code",
    "留下联系方式": "Leave your details",
    "添加微信": "Add on WeChat",
    "怎么称呼您": "Your name",
    "需求描述": "Your requirement",
    "提交留言": "Send message",
    "发送": "Send",
    "返回": "Back",
    "关闭": "Close",
    "关闭提醒": "Dismiss",
    "新会话": "New conversation",
    "开始新会话": "Start a new conversation",
    "输入您的问题…": "Type your question…",
    "如：李经理": "e.g. Mr. Li",
    "手机或固话": "Mobile or landline",
    "产品、人数、客户要求……": "Product, headcount, customer requirements…",
    "已收到您的消息，客服看到会尽快回复您。": "Message received — our team will get back to you shortly.",
    "请填写称呼和联系电话。": "Please fill in your name and phone number.",
    "提交中…": "Sending…",
    "提交失败": "Submission failed",
    "提交成功，我们会尽快与您联系！": "Sent. We will contact you shortly.",
    "（访客通过留言表单联系）": "(Visitor contacted us via the message form)"
  };

  /* 需要整段替换 HTML 的位置（保留内部标签样式） */
  var HTML = {
    heroTitle: "Complex certification,<br />handed to <em>people who know audits</em>",
    formHint: 'Fields marked <i style="color:#d9534f;font-style:normal">*</i> are required. Your details are used only for this enquiry.'
  };

  /* ---------------- 4. 应用翻译 ---------------- */
  var ZH = /[\u4e00-\u9fa5]/;

  function applyText(node) {
    var raw = node.nodeValue;
    if (!raw || !ZH.test(raw)) return;
    var p = node.parentNode;
    if (p && (p.nodeName === "SCRIPT" || p.nodeName === "STYLE")) return;  /* 不碰脚本内文本 */
    var t = raw.replace(/\s+/g, " ").trim();
    if (!Object.prototype.hasOwnProperty.call(UI, t)) return;
    var en = UI[t];
    var lead = raw.match(/^\s*/)[0];
    var tail = raw.match(/\s*$/)[0];
    var next = lead + en + tail;
    /* 值相同不写入：杜绝 MutationObserver 自触发循环（防卡死） */
    if (node.nodeValue !== next) node.nodeValue = next;
  }

  var ATTRS = ["placeholder", "aria-label", "title", "alt"];

  function applyAttrs(el) {
    for (var i = 0; i < ATTRS.length; i++) {
      var a = ATTRS[i];
      if (!el.hasAttribute || !el.hasAttribute(a)) continue;
      var v = el.getAttribute(a);
      if (!v || !ZH.test(v)) continue;
      var t = v.replace(/\s+/g, " ").trim();
      if (Object.prototype.hasOwnProperty.call(UI, t) && el.getAttribute(a) !== UI[t]) el.setAttribute(a, UI[t]);
    }
  }

  function apply(root) {
    if (!root) return;
    if (root.nodeType === 3) { applyText(root); return; }
    if (root.nodeType !== 1 && root.nodeType !== 9) return;

    /* data-i18n 整段替换（值相同不重写，防 MutationObserver 循环） */
    if (root.nodeType === 1 && root.hasAttribute && root.getAttribute("data-i18n")) {
      var key = root.getAttribute("data-i18n");
      if (HTML[key] && root.innerHTML !== HTML[key]) root.innerHTML = HTML[key];
    }
    if (root.querySelectorAll) {
      var marked = root.querySelectorAll("[data-i18n]");
      for (var m = 0; m < marked.length; m++) {
        var k = marked[m].getAttribute("data-i18n");
        if (HTML[k] && marked[m].innerHTML !== HTML[k]) marked[m].innerHTML = HTML[k];
      }
      var all = root.querySelectorAll("*");
      for (var i = 0; i < all.length; i++) applyAttrs(all[i]);
    }
    applyAttrs(root);

    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        var pn = n.parentNode && n.parentNode.nodeName;
        if (pn === "SCRIPT" || pn === "STYLE") return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    }, false);
    var n;
    while ((n = walker.nextNode())) applyText(n);
  }

  /* SEO 元信息 + 结构化数据同步英文 */
  function applySeo() {
    var desc = "GRS, ISCC, EcoVadis, BSCI, SLCP and ISO certification consulting for manufacturers — gap diagnosis, documentation, on-site remediation and audit support.";
    var setMeta = function (sel, attr, val) {
      var el = document.querySelector(sel);
      if (el) el.setAttribute(attr, val);
    };
    setMeta('meta[name="description"]', "content", desc);
    setMeta('meta[property="og:description"]', "content", desc);
    setMeta('meta[property="og:title"]', "content", "Shenzhen Zenithe Technical Service — one-stop compliance consulting");
    var ld = document.querySelector('script[type="application/ld+json"]');
    if (!ld) return;
    try {
      var o = JSON.parse(ld.textContent);
      if (!o || o["@type"] !== "Organization") return;
      o.name = "Shenzhen Zenithe Technical Service Co., Ltd.";
      o.description = desc;
      o.address = { "@type": "PostalAddress", addressCountry: "CN", addressRegion: "Guangdong", addressLocality: "Dongguan" };
      o.knowsAbout = ["GRS certification", "ISCC certification", "EcoVadis rating", "BSCI audit", "ISO 9001"];
      ld.textContent = JSON.stringify(o);
    } catch (e) {}
  }

  function applyAll() {
    apply(document.body);
    if (document.title && ZH.test(document.title)) {
      var t = document.title.replace(/\s+/g, " ").trim();
      if (UI[t]) document.title = UI[t];
    }
    applySeo();
    document.documentElement.setAttribute("lang", "en");
    document.body.classList.add("lang-en");
  }

  /* ---------------- 5. 动态内容 ----------------
     不再用 MutationObserver 监听翻译：浏览器自带"网页翻译"会与本引擎
     互相改写文本导致死循环卡死（页面无响应）。动态内容统一在渲染时用
     L("中文","English") 直接出对应语言，无需事后翻译。 */
  function observe() { /* 已废弃，保留空实现防止旧引用报错 */ }

  /* ---------------- 6. 切换按钮 ---------------- */
  function bindLang() {
    var links = document.querySelectorAll(".lang a");
    for (var i = 0; i < links.length; i++) {
      (function (a) {
        var tag = a.getAttribute("data-lang");
        var label = (a.textContent || "").trim();
        var isEn = tag ? tag === "en" : /^EN$/i.test(label);
        a.classList.toggle("on", isEn ? LANG === "en" : LANG === "zh");
        a.setAttribute("href", "javascript:void(0)");
        a.addEventListener("click", function (e) {
          e.preventDefault();
          var next = isEn ? "en" : "zh";
          if (next === LANG) return;
          try { localStorage.setItem("zt_lang", next); } catch (err) {}
          /* 去掉网址里的 ?lang=，否则会和刚选的语言打架 */
          try {
            var u = new URL(location.href);
            u.searchParams.delete("lang");
            u.searchParams.set("_r", String(Date.now()));
            location.replace(u.toString());
          } catch (err2) {
            location.reload();
          }
        });
      })(links[i]);
    }
  }

  /* ---------------- 7. 启动 ---------------- */
  function boot() {
    bindLang();
    applyAll();
    observe();
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
