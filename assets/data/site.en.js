/* ==========================================================================
   英文版内容配置（English content）
   仅当访客切换到 EN 时生效，会覆盖 assets/data/site.js 中的对应字段
   结构必须与中文版保持一致（数组会整体替换，所以每项要给全字段）
   ========================================================================== */

window.SITE_EN = {

  company: {
    name: "Zenithe Technical Service Co., Ltd.",
    nameEn: "Compliance & Certification",
    mark: "Z",
    slogan: "Make every audit a competitive advantage",
    desc: "For more than a decade we have helped manufacturers achieve social, quality and sustainability certification — from gap assessment and documentation to on-site remediation and certificate issuance.",
    phone: "400-883-0903",
    phoneRaw: "4008830903",
    mobile: "400-883-0903",
    email: "service@example.com",
    address: "18/F, Tower A, International Business Center, Nancheng District, Dongguan, Guangdong, China",
    hours: "Mon–Sat 09:00–18:00",
    icp: "粤ICP备00000000号",
    police: "粤公网安备 00000000000000 号",
    copyright: "© 2026 Zenithe Technical Service Co., Ltd. All rights reserved."
  },

  nav: [
    { text: "Home", href: "index.html" },
    { text: "Services", href: "services.html" },
    { text: "Case Studies", href: "cases.html" },
    { text: "About Us", href: "about.html" },
    { text: "Insights", href: "news.html" },
    { text: "Contact", href: "contact.html" }
  ],

  stats: [
    { num: "12", unit: "yrs", label: "Industry experience" },
    { num: "3600", unit: "+", label: "Clients served" },
    { num: "98", unit: "%", label: "First-time pass rate" },
    { num: "40", unit: "+", label: "Standards covered" }
  ],

  services: [
    {
      slug: "grs",
      icon: "recycle",
      title: "GRS – Global Recycled Standard",
      desc: "Recycled-content verification, TC transaction certificates and end-to-end traceability — the entry ticket to international brand supply chains.",
      tags: ["Recycled content", "TC certificates", "Traceability"],
      intro: "The Global Recycled Standard verifies how much recycled material actually goes into a product, and whether the entire chain — from recyclate to finished goods — can be traced. Brands, retailers and investors use it to judge whether an environmental claim holds up, which makes GRS close to mandatory for textile and packaging suppliers selling into Europe and North America. We don't just fill in forms: we calculate your input-output and recycled content, build the mass-balance and batch-tracing system, then support you through the audit and your TC applications.",
      fit: [
        "Weavers, knitters, dyers and yarn spinners using recycled polyester or nylon",
        "Recycled plastic compounders, packaging producers, injection and blow moulders",
        "Garment and home-textile factories supplying international brands that require TCs",
        "Trading companies without a plant (trader certification is available)"
      ],
      cycle: "4–8 weeks, including certification body scheduling, assuming documents are ready",
      docs: [
        "Business licence, site ownership or lease agreement",
        "Contracts, invoices and upstream TCs for recycled raw material",
        "Mass-balance records: input, output, losses and inventory ledgers",
        "Full process flow chart and workshop photographs",
        "Chemical inventory, MSDS and wastewater treatment documentation",
        "Staff training records and appointment letters for system owners"
      ],
      faqs: [
        { q: "How is recycled content actually calculated?", a: "Under the GRS mass-balance rules: certified recycled input weight, minus non-recycled auxiliaries and normal processing loss, divided by total finished weight. The hard part is keeping batch ledgers reconcilable. We provide ready-to-use templates and verify your first month of data on site." },
        { q: "Can a trading company without a factory apply?", a: "Yes — through GRS Trader certification. The focus is traceability of purchase and sales records plus warehouse and subcontractor control. Less paperwork than a plant, usually 4–5 weeks." },
        { q: "How long does a TC take?", a: "After certification, each shipment needs its own transaction certificate. With complete documents it normally takes 3–7 working days; we prepare and follow up to avoid rejections caused by mismatched descriptions." }
      ]
    },
    {
      slug: "iscc",
      icon: "leaf",
      title: "ISCC Sustainability Certification",
      desc: "ISCC EU and PLUS — from collecting-point registration to greenhouse-gas accounting, so biomass and circular-material producers can export compliantly.",
      tags: ["ISCC EU", "ISCC PLUS", "Carbon footprint"],
      intro: "ISCC is an EU-recognised sustainability scheme with two branches: EU for biofuels under the RED directive, and PLUS for biomass and circular materials across chemicals, plastics, packaging and feed. It audits two things — whether feedstock is sustainable, and whether greenhouse-gas savings meet the threshold. EU customers typically ask for the certificate and sustainability declaration before they will place an order.",
      fit: [
        "Used cooking oil, biodiesel and biomass fuel producers and traders",
        "Recycled plastics, circular chemicals and bio-based material plants",
        "Suppliers exporting raw or intermediate materials to the EU",
        "Packaging and chemical companies asked by brands for ISCC PLUS"
      ],
      cycle: "6–10 weeks, including the initial audit and closure of non-conformities",
      docs: [
        "Feedstock list and sustainability declarations, including collecting points",
        "Mass-balance ledgers and warehouse records",
        "Greenhouse-gas calculation sheet (energy, transport, process emissions)",
        "Supply-chain partner list, contracts and invoices",
        "Site layout, tank and metering equipment information",
        "Management system documents and nominated responsible persons"
      ],
      faqs: [
        { q: "What is the difference between ISCC EU and ISCC PLUS?", a: "EU covers biofuels and is bound by the EU RED directive, so compliance is stricter. PLUS covers biomass and circular materials for chemicals, plastics and packaging, and is usually driven by brand customers. Which one you need depends on who buys your product — we can help you decide." },
        { q: "Is greenhouse-gas accounting mandatory?", a: "Yes. GHG savings are a core ISCC indicator: you must demonstrate a minimum reduction against the fossil baseline. We build the calculation sheet for you; you only supply energy and transport data." },
        { q: "Can traders apply?", a: "Yes, under the collecting point / trader category. The focus is feedstock traceability and mass-balance records; no production site is required." }
      ]
    },
    {
      slug: "ecovadis",
      icon: "award",
      title: "EcoVadis Rating Improvement",
      desc: "Gap diagnosis against 21 criteria in four themes, policy and evidence gaps closed — clients typically gain one to two rating tiers.",
      tags: ["Gap diagnosis", "Documentation", "Evidence chain"],
      intro: "EcoVadis is the ESG rating most international brands rely on. It scores 21 criteria across environment, labour and human rights, business ethics and sustainable procurement — and the result decides whether you stay on a customer's approved list. Scoring is not about polished wording; it is about whether every claim is backed by verifiable evidence. We work through the scorecard criterion by criterion, close policy, data and proof gaps, and rewrite the narrative so an assessor can follow it.",
      fit: [
        "Export manufacturers asked by European customers to submit an EcoVadis rating",
        "Suppliers with a low first score who have been asked to improve",
        "Growth companies using the rating for brand credibility and international tenders",
        "Groups needing one consistent approach across several plants"
      ],
      cycle: "6–12 weeks, depending on the number of gaps and data availability",
      docs: [
        "Policies across environment, labour, ethics and sustainable procurement",
        "Twelve months of energy, water, waste and emissions data",
        "Training, safety and occupational-health records",
        "Supplier code of conduct, assessment and onboarding records",
        "Disclosures of fines, complaints and litigation over three years",
        "Existing certificates such as ISO 14001, ISO 45001 or SA8000"
      ],
      faqs: [
        { q: "How is the score calculated?", a: "Four themes are weighted, and each criterion earns points across four levels: policies, actions, results and reporting. Scores are then benchmarked by sector and company size. Most companies lose points for having policies without data, or actions without evidence." },
        { q: "What score earns a Silver medal?", a: "Tiers are set by annual global percentiles. Roughly 60 points usually reaches Silver and 70-plus approaches Gold, but the thresholds move each year. We first calculate the score you can secure, then assess the cost of pushing for the next tier." },
        { q: "Does it have to be renewed every year?", a: "A rating is valid for 12 months and must be resubmitted. From the second cycle we only do incremental updates and data refresh — about one third of the first-year effort." }
      ]
    },
    {
      slug: "bsci",
      icon: "globe",
      title: "BSCI / SLCP Social Compliance",
      desc: "Full pre-assessment of labour, working hours, wages and health and safety, remediated from an auditor's point of view.",
      tags: ["BSCI", "SLCP", "Sedex"],
      intro: "BSCI (amfori), SLCP and Sedex/SMETA are the social audits most Western buyers rely on. They probe the difficult areas: wages and hours, employment contracts, fire safety, occupational health and subcontracting. Failures are rarely about documents — they happen when records don't match reality, because payroll, attendance and output data must corroborate each other. We run a full mock audit first, surface the contradictions, then fix the system behind them.",
      fit: [
        "Apparel, home textile, footwear and consumer-goods factories exporting to Europe and the US",
        "Sites with serious findings in past audits that must be re-audited",
        "Suppliers managing multiple customers on the Sedex platform",
        "Manufacturers relying heavily on temporary labour or outsourced processes"
      ],
      cycle: "3–6 weeks preparation, 1–3 days on-site audit; re-audit depends on findings",
      docs: [
        "Twelve months of payroll, attendance records and bank statements",
        "Employment contracts, social insurance receipts and staff roster",
        "Fire acceptance, evacuation drills and safety training records",
        "Environmental permits, discharge licence and hazardous-waste contracts",
        "Subcontractor list and description of outsourced processes",
        "Worker interview preparation, grievance channels and union documents"
      ],
      faqs: [
        { q: "How do you handle zero-hours and excessive overtime?", a: "First we check whether the hours are an artefact of piece-rate back-calculation. We re-sequence shifts and restructure piece rates so payroll, attendance and output tell the same story, and complete the comprehensive working-hour approval — instead of simply editing numbers, which never survives an audit." },
        { q: "How do you prepare for an unannounced audit?", a: "Unannounced audits test daily practice, so last-minute documents don't help. We embed compliance routines at team-leader level: who records what, when, and who verifies it — backed by a checklist people actually use." },
        { q: "What is the relationship between BSCI and Sedex?", a: "BSCI is an amfori audit standard; Sedex is a data-sharing platform whose audit methodology is SMETA. Many buyers accept a Sedex report in place of BSCI. We help you choose the lower-cost route for your customer." }
      ]
    },
    {
      slug: "iso",
      icon: "shield",
      title: "ISO & Supply-Chain Security",
      desc: "ISO 9001, 14001, 45001 plus C-TPAT / SCAN security audits — from writing the system to making it work on the floor.",
      tags: ["ISO 9001", "C-TPAT", "SCAN"],
      intro: "ISO 9001, 14001 and 45001 are the baseline for tenders and customer approval, while C-TPAT and SCAN cover supply-chain security for US-bound shipments. The usual failure mode is a beautiful manual nobody follows — an auditor asks a team leader one question and the gap shows. We write documents from your real processes, train down to the workstation, and lead the first internal audit and management review ourselves.",
      fit: [
        "Companies needing certificates for tenders or approved-supplier lists",
        "Manufacturers and logistics firms exporting to the US under C-TPAT / SCAN",
        "Growing companies whose parallel systems contradict each other",
        "Factories using certification to streamline flow, rework and complaints"
      ],
      cycle: "2–3 months, including the system operation period and certification body scheduling",
      docs: [
        "Organisation chart, department responsibilities and job descriptions",
        "Existing process documents, work instructions and form records",
        "Internal audit, management review and corrective action records",
        "Risk and opportunity assessment, compliance obligation register",
        "Gate control, CCTV, visitor and cargo movement logs (security scope)",
        "Equipment register, calibration and statutory inspection reports"
      ],
      faqs: [
        { q: "Can we just use a template for the system documents?", a: "Only the framework. Clauses have to land on your own processes. We interview key roles, map the real flow, then derive the documents — so when an auditor asks 'how do you execute this?', your people can answer." },
        { q: "How should we choose a certification body?", a: "Three checks: is it on your customer's approved list, does its IAF code cover your product, and does its schedule fit your delivery dates. We don't mandate one, but we will get you two or three comparable quotes." },
        { q: "Are the certificates internationally recognised?", a: "Certificates from CNCA-approved bodies carry the CNAS/IAF mark and are accepted under the IAF multilateral agreement. If a customer insists on a specific body such as SGS or TÜV, confirm that up front." }
      ]
    },
    {
      slug: "lean",
      icon: "chart",
      title: "Plant Layout & Cost Reduction",
      desc: "Workshop layout, material flow and capacity modelling aligned with certification requirements, so compliance spend also lifts delivery performance.",
      tags: ["Plant layout", "Capacity modelling", "Lean improvement"],
      intro: "Many companies finish certification only to find their layout was assembled to satisfy an auditor: convoluted flow, work-in-progress piling up, unit labour cost stuck high. We design certification requirements — zoning, personnel and material segregation, traceability points — together with lean layout, so the compliance investment also improves lead time and output per head.",
      fit: [
        "Companies building a new plant or expanding, that need to get the layout right once",
        "Factories hitting a capacity bottleneck or accumulating WIP after certification",
        "Manufacturers facing rising labour cost who need higher output per person",
        "High-mix, low-volume production with frequent line changes"
      ],
      cycle: "4–8 weeks: one week diagnosis, two to three weeks design, then implementation coaching",
      docs: [
        "Current layout drawings, equipment list and footprint dimensions",
        "Cycle time, capacity and yield data by process",
        "Process flow chart and material flow description",
        "Headcount plan and shift arrangement",
        "Six months of output, delivery and inventory data"
      ],
      faqs: [
        { q: "Will the rebuild disrupt production?", a: "We design a zoned, rolling conversion: non-bottleneck areas first, key equipment moved over weekends or planned downtime, with each disruption held to one or two days." },
        { q: "How quickly does the investment pay back?", a: "Savings typically come from lower WIP, higher output per head and less rework. The proposal includes quantified projections and a payback period, usually 6–18 months." },
        { q: "Is this related to certification?", a: "Yes. Zoning, segregation and traceability marking are layout elements too — doing both at once avoids paying for a second conversion later." }
      ]
    }
  ],

  advantages: [
    { title: "Our own consultants, never subcontracted", desc: "More than 40 full-time consultants with an average of eight years' experience; the same team stays on your project end to end." },
    { title: "Diagnosis before quotation", desc: "A free on-site or online assessment, then a proposal based on real gaps and workload — transparent, itemised and split by phase." },
    { title: "We stay until the certificate is issued", desc: "On-site audit support, same-day correction of findings and closure tracking until the certificate is in your hands." },
    { title: "Long-term maintenance, no lapses", desc: "Free reminders of surveillance audit dates, plus immediate notification when a standard changes." }
  ],

  process: [
    { title: "Scoping", desc: "Understand your products, customer requirements and target markets; confirm which standards apply." },
    { title: "Gap diagnosis", desc: "Check every clause against your current state and deliver an actionable remediation list." },
    { title: "Implementation", desc: "Documentation system, on-site remediation and staff training." },
    { title: "Audit & certification", desc: "Application, full audit support, closure of non-conformities and certificate issuance." }
  ],

  /* Homepage client wall (sample names — replace with real clients) */
  clients: [
    { name: "Hongtai Textiles", en: "Dongguan" },
    { name: "Xingchen Electronics", en: "Shenzhen" },
    { name: "Junhua Plastics", en: "Foshan" },
    { name: "Lvyuan Packaging", en: "Suzhou" },
    { name: "Hengsheng Hardware", en: "Zhongshan" },
    { name: "Kaixin Apparel", en: "Huizhou" },
    { name: "Beishun Chemicals", en: "Guangzhou" },
    { name: "Yuanda Precision", en: "Ningbo" },
    { name: "Donglian Toys", en: "Shantou" },
    { name: "Zhongke New Materials", en: "Hefei" }
  ],

  /* Certification categories (homepage tabs) */
  certCats: [
    {
      name: "Sustainability",
      items: [
        { abbr: "GRS", color: "#2e9e5b", title: "GRS – Global Recycled Standard" },
        { abbr: "RCS", color: "#1c9a8f", title: "RCS – Recycled Claim Standard" },
        { abbr: "ISCC", color: "#1c7cc0", title: "ISCC sustainability certification" },
        { abbr: "OBP", color: "#0f7fb8", title: "OBP – Ocean Bound Plastic" },
        { abbr: "GOTS", color: "#5b8f3e", title: "GOTS – Organic Textile Standard" }
      ]
    },
    {
      name: "Social Compliance",
      items: [
        { abbr: "BSCI", color: "#d97a2b", title: "BSCI social compliance audit" },
        { abbr: "Sedex", color: "#d94f43", title: "Sedex / SMETA audit" },
        { abbr: "SLCP", color: "#6a4fa3", title: "SLCP convergence assessment" },
        { abbr: "SA8000", color: "#b03a48", title: "SA8000 social accountability" },
        { abbr: "RBA", color: "#33679b", title: "RBA – Responsible Business Alliance" }
      ]
    },
    {
      name: "Systems & Ratings",
      items: [
        { abbr: "ISO", color: "#0b4a6f", title: "ISO 9001 Quality management" },
        { abbr: "ISO", color: "#0a8a6d", title: "ISO 14001 Environmental management" },
        { abbr: "ISO", color: "#3f6fb5", title: "ISO 45001 Occupational health & safety" },
        { abbr: "EcoVadis", color: "#16457c", title: "EcoVadis sustainability rating" },
        { abbr: "CTPAT", color: "#37536b", title: "C-TPAT / SCAN supply-chain security" }
      ]
    }
  ],

  /* Three flagship services */
  bigServices: [
    { title: "Audit & Certification", desc: "Consultants versed in every major audit standard deliver gap diagnosis through audit support and certification for export manufacturers.", icon: "shield" },
    { title: "Sustainability Advisory", desc: "Focused on recycled materials and supply-chain carbon — recycled-content schemes, footprint accounting and disclosure readiness.", icon: "recycle" },
    { title: "Management Training", desc: "Courses built on your real processes: system documentation, internal auditor training and interview readiness for the shop floor.", icon: "users" }
  ],

  /* Comparison: us vs typical consultancies */
  compare: {
    rows: [
      { k: "Consultant team", ours: "Full-time consultants with 5+ years; over a third ex-auditors who know the standard inside out", theirs: "Part-time staff, high turnover, uneven accountability" },
      { k: "Process control", ours: "Project-based tracking with visible milestones — no delays, no buck-passing", theirs: "Verbal management, shifting blame, missed deadlines" },
      { k: "Pricing", ours: "Transparent contract pricing with no hidden extras", theirs: "Low-ball signing, extra charges midway" },
      { k: "Documentation", ours: "Template library plus on-site interviews — documents right the first time", theirs: "Generic templates, handwritten overtime work, constant rework" },
      { k: "Audit resources", ours: "Familiar with certification-body rules; scheduling and remediation planned ahead", theirs: "Outdated information, passive scheduling" },
      { k: "After-sales", ours: "Free surveillance reminders and document updates while the certificate is valid", theirs: "Expensive after-sales, updates billed separately" }
    ]
  },

  /* Six-step cooperation process */
  steps6: [
    { title: "Enquiry", desc: "Call or message us about your products and customer requirements" },
    { title: "Assessment", desc: "Free gap diagnosis with timeline and workload" },
    { title: "Contract", desc: "Deliverables, schedule and fees in writing" },
    { title: "Implementation", desc: "Documentation, on-site remediation and training" },
    { title: "Delivery", desc: "Full audit support until the certificate is issued" },
    { title: "After-sales", desc: "Surveillance reminders, transitions and free advice" }
  ],

  /* About section qualification list */
  /* Detail sidebar: more services + recommended cases */
  moreServices: [
    { name: "GOTS Organic Textiles", href: "services.html" },
    { name: "OCS Organic Content Standard", href: "services.html" },
    { name: "ISO 14021 Recycled Content Claims", href: "services.html" },
    { name: "Science Based Targets (SBTi)", href: "services.html" },
    { name: "B-Corp Certification", href: "services.html" },
    { name: "EU Battery Regulation", href: "services.html" }
  ],

  aboutCerts: [
    "SCM working group member, international chemicals manufacturers association",
    "Recognised Sedex consulting partner",
    "SLCP advisory organisation",
    "Long-term partner of GRS / RCS certification bodies",
    "Practitioner of EcoVadis rating improvement",
    "3,600+ BSCI projects delivered end to end",
    "One-stop ISO system certification provider",
    "C-TPAT / SCAN supply-chain security advisory",
    "Member of provincial export-compliance chamber",
    "Quality-management internship base for universities",
    "Over a third of consultants hold auditor qualifications",
    "3,600+ manufacturers served to date"
  ],

  /* Bottom feature strip */
  waiter: [
    { k: "Expert team", v: "One-to-one specialist service" },
    { k: "Fast response", v: "Quick diagnosis, faster certification" },
    { k: "Deep experience", v: "Ten years of proven methods" },
    { k: "Save cost & effort", v: "Fully managed, progress visible" }
  ],

  news: [
    {
      slug: "grs-4-transition",
      date: "2026-10-18",
      tag: "Policy",
      title: "GRS 4.0 transition: three changes to recycled-content claims and TCs",
      excerpt: "The new version tightens the definition of pre- and post-consumer material. Here are the three places companies trip up — and what to do about them.",
      body: [
        { p: "GRS 4.0 defines pre-consumer and post-consumer recycled material far more precisely. The immediate effect: offcuts and rejects that used to be pooled into one figure must now be recorded separately, or the recycled content of the whole batch will not be accepted." },
        { h: "Change 1: harder proof for pre-consumer waste", p: "An internal transfer note is no longer enough. You need a record chain proving the waste came from your own production — process, batch, weight and time. Many plants weigh offcuts and feed them straight back with no process link, so this ledger has to be built." },
        { h: "Change 2: TC product descriptions must match the invoice", p: "Certification bodies now compare contract, invoice and product description word by word when issuing TCs. Common rejections come from writing 'polyester yarn' instead of 'recycled polyester yarn', or from unit mismatches. Do a description check before every shipment." },
        { h: "Change 3: traceability duty moves to traders", p: "Traders are no longer just passing certificates along; they must verify the validity of their suppliers' certification. Issuing a TC while an upstream certificate is suspended is treated as a serious non-conformity." },
        { h: "What to do now", p: "First, recalculate three months of mass balance under the new rules and see whether your recycled percentage still holds. Second, align internal product names with invoice descriptions. Third, obtain and file proof of upstream certificate validity. Do these three and the transition audit should pass without drama." }
      ]
    },
    {
      slug: "ecovadis-silver",
      date: "2026-09-26",
      tag: "Case study",
      title: "From 42 to 61: one plastics company's route to an EcoVadis Silver medal",
      excerpt: "Eleven weeks closing evidence gaps in environment and labour lifted the rating from Bronze to Silver and onto a European customer's approved list.",
      body: [
        { p: "The company compounds recycled plastics, with annual revenue around RMB 120 million and mainly European packaging brands as customers. Its first EcoVadis score was 42 (Bronze); the customer asked for Silver within twelve months." },
        { h: "Diagnosis: the gap was data, not policy", p: "In the environment theme there were policies but no quantified results; labour lacked training and incident records; business ethics was almost empty. An assessor's logic is simple: if you say the system exists, where is the execution data?" },
        { h: "Action: three evidence streams", p: "First, twelve months of monthly energy, water and waste data plus a short environmental report. Second, training attendance sheets, fire drills and occupational health checks. Third, a supplier onboarding and assessment form that turns sustainable procurement from a slogan into a process." },
        { h: "Result: 61 points in eleven weeks", p: "The resubmission scored 61 (Silver), the company joined the customer's approved list and qualified to quote on two new projects. Their own verdict: the real gain was not the medal but seeing energy consumption and yield on the same sheet for the first time." }
      ]
    },
    {
      slug: "csddd-impact",
      date: "2026-08-30",
      tag: "Industry",
      title: "After CSDDD: how supply-chain audits will change",
      excerpt: "Due diligence is moving from voluntary to mandatory. Brands will pass the pressure down — tier-two suppliers should prepare now.",
      body: [
        { p: "The Corporate Sustainability Due Diligence Directive turns environmental and human-rights due diligence from a voluntary initiative into a legal obligation. To limit their own liability, brands will write these requirements into purchase contracts, and the pressure will travel down to tier-two and tier-three suppliers." },
        { h: "Three predictable shifts", p: "First, audit frequency rises but the format moves from one-off factory audits to continuous data reporting. Second, requirements expand from proof of compliance to proof of improvement. Third, contracts will include due-diligence breach and exit clauses." },
        { h: "Where tier-two suppliers actually stand", p: "Most have no dedicated ESG staff and no systems. The answer is not to wait for a customer visit but to get three basics solid: traceable energy and waste data, a working worker grievance channel, and explainable feedstock origin. These cover about 80 percent of the questions that come up." },
        { h: "Suggested sequence", p: "Start with a light gap assessment of one to two weeks, sorting issues into 'customers will definitely ask' and 'might ask', then fix the first group. With a limited budget, spend on data systems rather than brochures — auditors read data, customers read ratings, and both come from the same source." }
      ]
    },
    {
      slug: "lab-upgrade",
      date: "2026-07-15",
      tag: "Company news",
      title: "New recycled-material lab added to our service centre",
      excerpt: "In-house pre-testing of recycled content shortens turnaround and cuts re-test failure rates.",
      body: [
        { p: "We have added a recycled-material laboratory to our service centre, equipped with FTIR and thermal analysis, for pre-certification recycled-content testing and material consistency checks." },
        { h: "What it solves", p: "Third-party testing used to take 7–15 working days, and any formula or batch deviation meant resubmitting. Pre-testing locally confirms the recycled ratio and material grade before formal testing, which noticeably reduces rework." },
        { h: "How clients use it", p: "At project kick-off we sample a baseline as the reference for mass-balance calculation; before the audit we sample again to confirm production batches match the declaration. Some clients have cut turnaround from two weeks to three days." }
      ]
    }
  ],

  cases: [
    {
      industry: "Textiles",
      title: "Recycled polyester fabric mill · first GRS 4.0 certification",
      situation: "Shipping on a trader's TC, with no mass-balance ledger and batches that could not be matched — the customer's audit found the recycled content unprovable.",
      action: "Rebuilt batch ledgers and input-output tables, standardised product descriptions, verified upstream certificate validity, and supported the first audit on site.",
      result: "Passed first time, obtained the certificate and joined three brand customers' approved supplier lists.",
      metrics: [{ k: "Timeline", v: "7 weeks" }, { k: "Recycled content", v: "52%" }, { k: "Result", v: "First-time pass" }]
    },
    {
      industry: "Plastic packaging",
      title: "Recycled PE pellet producer · ISCC PLUS certification",
      situation: "An EU customer required sustainability certification, but mass balance and greenhouse-gas accounting were both missing.",
      action: "Built the mass-balance ledger, completed GHG accounting and reduction evidence, and structured collecting-point and supply-chain documents.",
      result: "Certified to ISCC PLUS, entered the European packaging supply chain and grew exports by about 30 percent.",
      metrics: [{ k: "Timeline", v: "9 weeks" }, { k: "GHG", v: "−18%" }, { k: "New clients", v: "2" }]
    },
    {
      industry: "Electronics",
      title: "Wiring harness plant · EcoVadis rating improvement",
      situation: "First rating 42 (Bronze); a European customer required Silver within twelve months, with environment and labour data missing.",
      action: "Closed the evidence chain for all 21 criteria, built twelve months of energy and training records, and rebuilt the sustainable procurement process.",
      result: "Rescored at 61 (Silver) after eleven weeks, joined the customer's approved list and qualified to quote on new projects.",
      metrics: [{ k: "Timeline", v: "11 weeks" }, { k: "Score gain", v: "+19" }, { k: "Result", v: "Silver" }]
    },
    {
      industry: "Textiles",
      title: "Home textile factory · BSCI re-audit",
      situation: "Payroll, attendance and output contradicted each other, with zero-hour and excessive overtime records; the first audit returned a C grade.",
      action: "Re-sequenced shifts and piece-rate structure, reconciled twelve months of payroll and attendance, closed fire-safety and training gaps, and ran two mock audits.",
      result: "Re-audited to grade B with serious findings cleared to zero, protecting the European order.",
      metrics: [{ k: "Timeline", v: "6 weeks" }, { k: "Grade", v: "C → B" }, { k: "Serious findings", v: "0" }]
    },
    {
      industry: "Chemicals",
      title: "Additives maker · integrated ISO triple certification",
      situation: "A tender required three certificates, while internal documents existed as separate sets disconnected from shop-floor practice.",
      action: "Rewrote system documents around real processes, merged three systems into one record set, and led the first internal audit and management review.",
      result: "Certified in ten weeks: three certificates in one pass, zero non-conformities.",
      metrics: [{ k: "Timeline", v: "10 weeks" }, { k: "Certificates", v: "3" }, { k: "Non-conformities", v: "0" }]
    },
    {
      industry: "Trading",
      title: "Export trading company · GRS trader certification",
      situation: "No factory of its own, but customers required GRS certificates and TCs, so the factory route was not available.",
      action: "Prepared an asset-light document pack for the trader category and structured the purchase-sales traceability chain plus warehouse and subcontractor control.",
      result: "Certified in five weeks, now able to issue TCs independently and no longer dependent on suppliers to quote.",
      metrics: [{ k: "Timeline", v: "5 weeks" }, { k: "Certificate", v: "1" }, { k: "TC", v: "Self-issued" }]
    }
  ],

  milestones: [
    { year: "2013", title: "Team founded", desc: "Started with social compliance audit support for manufacturers in the Pearl River Delta." },
    { year: "2017", title: "Systems certification added", desc: "Built a quality and environmental team covering the three main ISO systems." },
    { year: "2021", title: "Into sustainability", desc: "Created dedicated GRS, ISCC and EcoVadis units for export-oriented clients." },
    { year: "2026", title: "National network", desc: "Offices in South, East and North China; more than 3,600 companies served." }
  ],

  team: [
    { name: "Zhang", role: "Founder & Principal Consultant", initial: "Z" },
    { name: "Feng", role: "Director, Sustainability Practice", initial: "F" },
    { name: "Zhao", role: "Lead Auditor, Quality Systems", initial: "Z" },
    { name: "Pi", role: "Client Success Manager", initial: "P" }
  ],

  chat: {
    title: "Zenithe · Online Support",
    sub: "We reply within 2 hours during business hours",
    mark: "Z",
    wechatImg: "assets/img/wechat-qr.png?v=2026110427",
    faqs: [
      {
        q: "📞 What's your hotline?",
        keys: ["phone", "call", "hotline", "number", "telephone"],
        a: "Our hotline is <b>400-883-0903</b>, staffed 09:00–18:00 on business days. You can also tap WeChat below to scan and add a consultant."
      },
      {
        q: "⏱️ How long does certification take?",
        keys: ["how long", "duration", "timeline", "lead time", "weeks"],
        a: "ISO systems usually take 2–3 months; GRS and ISCC about 4–8 weeks; EcoVadis improvement 6–12 weeks. Send me your product and use case for a more precise schedule."
      },
      {
        q: "💰 What does it cost?",
        keys: ["cost", "price", "quote", "fee", "budget", "how much"],
        a: "Cost = consulting fee + certification body audit fee, driven by headcount, site size and scope. Leave your product and headcount and we'll send an itemised quote within 24 hours."
      },
      {
        q: "♻️ How does GRS work?",
        keys: ["grs", "recycled", "recycle"],
        a: "GRS requires proof of recycled content plus supply-chain traceability. We start with a free gap assessment, then you decide whether to launch the project."
      },
      {
        q: "🏭 How do you prepare us for BSCI?",
        keys: ["bsci", "audit", "social", "slcp", "sedex"],
        a: "For BSCI / SLCP social audits we run a full pre-assessment, mock audits and on-site remediation support — a 98 percent first-time pass rate."
      },
      {
        q: "🌱 And ISCC?",
        keys: ["iscc", "sustainability", "carbon", "ghg"],
        a: "ISCC covers both EU and PLUS, from feedstock registration to greenhouse-gas accounting, with full support from our side."
      },
      {
        q: "📍 Can you come on site?",
        keys: ["address", "location", "visit", "onsite", "where"],
        a: "We can start online. For an on-site diagnosis, book one day ahead and we will arrange a consultant to visit your plant."
      },
      {
        q: "🧷 Do you handle Sedex / SMETA?",
        keys: ["sedex", "smeta", "ethics"],
        a: "Yes — registration, self-assessment, mock audit and audit support for SMETA 4P and 2P. An audit can usually be arranged within 3–4 weeks."
      },
      {
        q: "🌍 How do we raise our EcoVadis score?",
        keys: ["ecovadis", "rating", "medal", "bronze", "silver", "gold"],
        a: "The key is the evidence chain: policies, training records and data reports. We have supported 200+ companies; the fastest moved from Bronze to Silver in six weeks."
      },
      {
        q: "📜 How long is a certificate valid?",
        keys: ["valid", "expire", "renew", "surveillance", "years"],
        a: "ISO certificates are valid for three years with one surveillance audit per year; customer audit reports usually last twelve months. Contact us two months before expiry and we'll arrange the renewal."
      },
      {
        q: "🏭 Do you have cases in our industry?",
        keys: ["case", "example", "experience", "client", "industry"],
        a: "We have served 500+ factories and traders across textiles, electronics, toys and chemicals. Check Case Studies in the top menu, or tell me your industry and I'll send a relevant case."
      }
    ],
    fallback: "Noted. You can also:<br>1️⃣ Call our hotline <b>400-883-0903</b><br>2️⃣ Leave your contact below and we'll call back within 2 hours",
    formEndpoint: ""
  }
};
