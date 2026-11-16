(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.SchoolGame = api;
  if (typeof document !== "undefined") api.mount(document.getElementById("app"));
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const UI = typeof CampusUI !== "undefined" ? CampusUI : null;
  const YEARS = 14;
  const SEASONS = ["春", "夏", "秋", "冬"];
  const SAVE_KEY = "president-sim-v4";

  const DEPTS = [
    { id: "sci", name: "理学", role: "学术和升格的硬指标" },
    { id: "eng", name: "工学", role: "科研、就业、能看见的成果" },
    { id: "cs", name: "计算机", role: "论文和国际合作" },
    { id: "biz", name: "经管", role: "校友、捐赠、学校的钱" },
    { id: "hum", name: "文法", role: "声誉，也是舆论和举报信" },
    { id: "med", name: "医学", role: "社会服务，太弱会被评估点名" }
  ];

  const RANKS = ["助教", "讲师", "副教授", "教授"];
  const TIERS = [
    { name: "大专", short: "高职" },
    { name: "本科", short: "本科" },
    { name: "212", short: "212" },
    { name: "986", short: "986" },
    { name: "D9", short: "D9" }
  ];

  const SURNAMES = ["周", "林", "陈", "赵", "吴", "孙", "郑", "何", "高", "马", "罗", "梁", "宋", "唐", "韩", "冯", "邓", "曹", "彭", "蒋"];
  const GIVEN = ["衡", "晚晴", "知夏", "穆清", "砚秋", "承志", "嘉树", "书白", "景行", "予安", "修远", "临川", "敬之", "安然", "明远", "叙白", "清和", "望舒"];

  function rand(n) { return Math.floor(Math.random() * n); }
  function pick(list) { return list[rand(list.length)]; }
  function clamp(n, a, b) { return Math.max(a, Math.min(b, Math.round(n))); }
  function uid() { return Math.random().toString(36).slice(2, 9); }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));
  }

  function deptById(state, id) { return state.depts.find((d) => d.id === id); }
  function teacherById(state, id) { return state.teachers.find((t) => t.id === id); }
  function deptTeachers(state, deptId) { return state.teachers.filter((t) => t.dept === deptId); }
  function leadOf(state, deptId) {
    const list = deptTeachers(state, deptId);
    return list.sort((a, b) => b.rank - a.rank || b.talent - a.talent)[0] || null;
  }
  function isChair(state, teacher) {
    if (!teacher || teacher.rank < 2) return false;
    const forced = state.chairOf && state.chairOf[teacher.dept];
    if (forced) {
      const named = teacherById(state, forced);
      if (named && named.rank >= 2) return forced === teacher.id;
    }
    const lead = leadOf(state, teacher.dept);
    return !!(lead && lead.id === teacher.id);
  }
  function avgDept(state) {
    return state.depts.reduce((s, d) => s + d.strength, 0) / state.depts.length;
  }
  function leverageTeachers(state) { return state.teachers.filter((t) => t.leverage); }

  function fullName(base, tier, track) {
    const stem = String(base || "江湾").trim().replace(/(职业技术大学|职业技术学院|职业学院|专科学校|学院|大学)$/g, "") || "江湾";
    if (tier <= 0) return stem + "职业技术学院";
    if (track === "vocational") return stem + "职业技术大学";
    if (tier === 1) return stem + "学院";
    return stem + "大学";
  }

  const PEDIGREES = [
    { id: 0, schools: ["本校"], degree: "本科" },
    { id: 1, schools: ["江城学院", "南岸学院", "临川学院"], degree: "硕士" },
    { id: 2, schools: ["滨江大学", "澄江大学", "东川大学"], degree: "博士" },
    { id: 3, schools: ["京华大学", "沪上大学", "岭南大学"], degree: "博士" },
    { id: 4, schools: ["剑桥合作校", "海德堡合作校", "东京合作校"], degree: "博士" }
  ];
  const PEDIGREE_WEIGHTS = [
    [50, 32, 14, 4, 0],
    [24, 34, 26, 12, 4],
    [8, 20, 32, 26, 14],
    [2, 10, 24, 34, 30],
    [0, 6, 16, 36, 42]
  ];
  const SKILLS = [
    { id: "research", name: "科研", stat: "academic", label: "学术" },
    { id: "class", name: "上课", stat: "teaching", label: "教学" },
    { id: "world", name: "国际", stat: "international", label: "国际影响" },
    { id: "enroll", name: "招生", stat: "enrollment", label: "报考" },
    { id: "rule", name: "学工", stat: "compliance", label: "风纪" }
  ];

  function rollPedigree(tier) {
    const weights = PEDIGREE_WEIGHTS[Math.max(0, Math.min(PEDIGREE_WEIGHTS.length - 1, tier || 0))];
    let roll = rand(weights.reduce(function (sum, n) { return sum + n; }, 0));
    for (let i = 0; i < weights.length; i++) {
      roll -= weights[i];
      if (roll < 0) return PEDIGREES[i];
    }
    return PEDIGREES[0];
  }

  function skillById(id) {
    return SKILLS.find(function (s) { return s.id === id; }) || SKILLS[0];
  }

  function giveBackground(teacher, tier) {
    const pedigree = rollPedigree(tier);
    teacher.pedigree = pedigree.id;
    teacher.school = pick(pedigree.schools);
    teacher.degree = pedigree.degree;
    teacher.skill = pick(SKILLS).id;
  }

  function makeTeacher(deptId, extra, tier) {
    const greed = extra && extra.greed != null ? extra.greed : rand(100);
    const teacher = Object.assign({
      id: uid(),
      name: pick(SURNAMES) + pick(GIVEN),
      dept: deptId,
      rank: 1,
      talent: 45 + rand(40),
      greed,
      loyalty: 50 + rand(30),
      leverage: false,
      skimming: false
    }, extra || {});
    if (!teacher.school) giveBackground(teacher, tier || 0);
    return teacher;
  }

  function createState(baseName, origin) {
    const depts = [
      { id: "sci", strength: 22 },
      { id: "eng", strength: 34 },
      { id: "cs", strength: 30 },
      { id: "biz", strength: 33 },
      { id: "hum", strength: 29 },
      { id: "med", strength: 18 }
    ].map((d) => ({ ...d, strength: clamp(d.strength + rand(7) - 3, 8, 95) }));

    const state = {
      baseName: baseName || "江湾",
      schoolName: "",
      year: 1,
      tier: 0,
      academic: 24,
      teaching: 36,
      reputation: 30,
      funds: 38,
      compliance: 74,
      international: 8,
      heat: 0,
      wound: 0,
      bribes: 0,
      reports: 0,
      resigns: 0,
      inspections: 0,
      bestRank: 0,
      depts,
      teachers: [],
      log: [],
      actionsLeft: 1,
      season: 0,
      used: {},
      reviewCursor: 0,
      phase: "play",
      scene: null,
      queue: [],
      ending: null,
      mode: "play",
      enrollment: 46,
      track: null,
      bachelorAt: 0,
      masterPoints: [],
      merged: null,
      mergeOffer: null,
      mergedThisYear: false,
      applyBlockYear: 0,
      strategy: null,
      strategyUntil: 0,
      rivalMomentum: 24,
      loanYears: 0,
      loanPayment: 4,
      achievements: [],
      dormPromise: 0,
      lastPoach: 0,
      lastRivalPush: 0,
      delayedReport: null,
      origin: origin || "old",
      policy: null,
      policyDept: null,
      succession: "",
      seenHospital: false,
      seenLoan: false,
      seenLetter: false,
      seenFactory: false,
      campus: {
        mu: 240,
        students: 4000,
        buildings: { teach: 1, dorm: 1, train: 0, lab: 0, lib: 0, industry: 0, gym: 0, intl: 0, hospital: 0, admin: 0 },
        pending: null
      },
      yearNotes: [],
      opening: null,
      story: {
        profId: null,
        profName: "",
        profAct: "pending",
        profBeat: 0,
        rivalBeat: 0,
        incidentKind: ["strike", "post", "accident"][rand(3)],
        incidentDept: null,
        incidentChoice: null,
        incidentBeat: 0,
        incidentFaceOk: false,
        enrollMod: 0
      }
    };
    state.schoolName = fullName(state.baseName, 0);
    applyOrigin(state);
    DEPTS.forEach((d) => {
      const strong = d.id === "eng" || d.id === "biz";
      state.teachers.push(makeTeacher(d.id, {
        rank: strong ? 2 : 1,
        talent: 48 + rand(28),
        greed: rand(100)
      }));
      state.teachers.push(makeTeacher(d.id, {
        rank: 0,
        talent: 34 + rand(36),
        greed: rand(100)
      }));
    });
    tuneOriginStaff(state);
    state.score = computeScore(state);
    note(state, originNote(state));
    markOpening(state);
    state.phase = "scene";
    state.scene = strategyScene(state, true);
    return state;
  }

  function ensureExtras(state) {
    if (state.rivalMomentum == null) state.rivalMomentum = 24;
    if (state.loanYears == null) state.loanYears = 0;
    if (state.loanPayment == null) state.loanPayment = 4;
    if (!state.achievements) state.achievements = [];
    if (state.strategyUntil == null) state.strategyUntil = 0;
    if (state.dormPromise == null) state.dormPromise = 0;
    if (state.lastPoach == null) state.lastPoach = 0;
    if (state.lastRivalPush == null) state.lastRivalPush = 0;
    if (!state.origin) state.origin = "old";
    if (state.policyDept == null) state.policyDept = null;
    if (state.succession == null) state.succession = "";
    if (state.seenHospital == null) state.seenHospital = false;
    if (state.seenLoan == null) state.seenLoan = false;
    if (state.seenLetter == null) state.seenLetter = false;
    if (state.seenFactory == null) state.seenFactory = false;
  }

  function applyOrigin(state) {
    if (state.origin === "trade") {
      bumpDept(state, "eng", 10);
      bumpDept(state, "med", 8);
      bumpDept(state, "sci", -4);
      state.funds = 26;
      state.teaching = 40;
      return;
    }
    if (state.origin === "college") {
      bumpDept(state, "sci", 8);
      state.teaching = 44;
      state.academic = 30;
      state.heat = 8;
      state.funds = 34;
    }
  }

  function tuneOriginStaff(state) {
    if (state.origin === "trade") {
      state.teachers.forEach(function (t) {
        t.pedigree = 0;
        t.school = "本校";
        t.degree = "本科";
      });
      const one = state.teachers[0];
      if (one) {
        one.pedigree = 1;
        one.school = "江城学院";
        one.degree = "硕士";
      }
      return;
    }
    if (state.origin === "college") {
      let have = state.teachers.filter(function (t) { return (t.pedigree || 0) >= 1; }).length;
      state.teachers.forEach(function (t) {
        if (have >= 4 || (t.pedigree || 0) >= 1) return;
        t.pedigree = 1;
        t.school = "南岸学院";
        t.degree = "硕士";
        have += 1;
      });
    }
  }

  function originNote(state) {
    if (state.origin === "trade") return "董事会把印交给你。这所学校靠工学和医学吃饭，硕博师资少，账也紧。";
    if (state.origin === "college") return "董事会把印交给你。理学和教学有一点底子。桌上有一份还没归档的旧材料。";
    return "董事会把印交给你。十四年，从这所大专开始算。";
  }

  function originName(id) {
    if (id === "trade") return "行业学校";
    if (id === "college") return "备升本的学院";
    return "老专科";
  }

  function policyName(state) {
    if (!state.policy) return "还没来";
    if (state.policy === "tight") return "拨款收紧";
    if (state.policy === "jobs") return "就业被抽查";
    return "专业调整 · " + deptName(state.policyDept);
  }

  const STRATEGIES = [
    { id: "research", name: "研究型", detail: "学术和理学更快。教学和经费更紧。" },
    { id: "applied", name: "应用型", detail: "工学和就业更好。国际影响涨得慢。" },
    { id: "medical", name: "医科特色", detail: "医学和声誉更快。每年多一笔开支。" },
    { id: "world", name: "国际化", detail: "国际影响更快。经费消耗大。" },
    { id: "industry", name: "产业型", detail: "经费和就业更好。学术和理学放慢。" }
  ];

  function strategyById(id) {
    return STRATEGIES.find(function (s) { return s.id === id; }) || null;
  }

  function strategyScene(state, first) {
    const current = strategyById(state.strategy);
    const body = first
      ? "先定这三年的方向。不占这一季。到期后可以换，提前换要掉声誉。"
      : "上一个三年到期了。沿用现在的方向不掉声誉。改方向，声誉 -6。现在是" + (current ? current.name : "还没定") + "。";
    return scene("这三年往哪边走", body, STRATEGIES.map(function (s) {
      return { id: "strategy:" + s.id, label: s.name, detail: s.detail };
    }), { kind: "event" });
  }

  function chooseStrategy(state, id) {
    const changed = state.strategy && state.strategy !== id;
    state.strategy = id;
    state.strategyUntil = state.year + 2;
    if (changed) {
      addStat(state, "reputation", -6);
      note(state, "规划改成" + strategyById(id).name + "。声誉 -6。");
    } else {
      note(state, "这三年按" + strategyById(id).name + "走。");
    }
    state.scene = null;
    state.queue = [];
    state.phase = "play";
    sync(state);
  }

  function rollPolicy(state) {
    const ids = ["tight", "major", "jobs"];
    state.policy = ids[rand(ids.length)];
    if (state.policy === "major") {
      const weak = state.depts.slice().sort(function (a, b) { return a.strength - b.strength; })[0];
      state.policyDept = weak ? weak.id : "hum";
    }
  }

  function policyScene(state) {
    const name = state.policyDept ? deptName(state.policyDept) : "一个系";
    const copy = {
      tight: ["拨款收紧了", "专项和校友的钱都会变少。找政府还是能要到东西，材料没那么扎眼。这条文管到任期结束。"],
      major: ["专业要调整", name + "被点了名。再拿它当门面，报考材料不好写。建设这个系会退回一截经费。这条文管到任期结束。"],
      jobs: ["就业要被抽查", "第 9 年的就业数据会有人来对。改口径比现在重得多。这条文管到任期结束。"]
    };
    const pair = copy[state.policy] || copy.tight;
    return scene(pair[0], pair[1], [{ id: "policy-ack", label: "知道了" }]);
  }

  function ackPolicy(state) {
    const label = policyName(state);
    note(state, "省里的文定了：" + label + "。");
    state.scene = null;
    state.queue = [];
    state.phase = "play";
    sync(state);
  }

  function successionScene(state) {
    const ranked = state.depts.slice().sort(function (a, b) { return b.strength - a.strength; });
    const strong = ranked[0];
    const loyal = state.teachers.slice().sort(function (a, b) { return b.loyalty - a.loyalty; })[0];
    const lead = strong ? leadOf(state, strong.id) : null;
    return scene(
      "谁来接这个位子",
      "还有两年。上面问卸任以后谁坐校长室。不占这一季。",
      [
        { id: "succeed:name", label: loyal ? "指定" + loyal.name : "指定现在最稳的人", detail: "他的忠诚上去，别人会不高兴。有把柄的话，风险留着。" },
        { id: "succeed:dept", label: strong ? "让给" + deptName(strong.id) : "让给最强的系", detail: lead ? lead.name + "会握住这个系。弱的那边更没人管。" : "最强的系握住位子。弱的那边更没人管。" },
        { id: "succeed:up", label: "把账面交上去", detail: "风险下去一点。信封洗不掉。上面自己安排。" }
      ]
    );
  }

  function chooseSuccession(state, how) {
    state.succession = how;
    if (how === "name") {
      const loyal = state.teachers.slice().sort(function (a, b) { return b.loyalty - a.loyalty; })[0];
      if (loyal) {
        loyal.loyalty = clamp(loyal.loyalty + 12, 0, 100);
        state.teachers.forEach(function (t) {
          if (t.id !== loyal.id) t.loyalty = clamp(t.loyalty - 4, 0, 100);
        });
        if (loyal.leverage) addStat(state, "heat", 4);
        note(state, "卸任以后的位子写了" + loyal.name + "。" + (loyal.leverage ? "他手里有把柄，风险还在。" : "别人的忠诚掉了一截。"));
      }
    } else if (how === "dept") {
      const ranked = state.depts.slice().sort(function (a, b) { return b.strength - a.strength; });
      const strong = ranked[0];
      const weak = ranked[ranked.length - 1];
      const lead = strong ? leadOf(state, strong.id) : null;
      if (strong) bumpDept(state, strong.id, 4);
      if (weak && strong && weak.id !== strong.id) bumpDept(state, weak.id, -4);
      if (lead) lead.leverage = true;
      addStat(state, "heat", 4);
      note(state, "位子让给了" + (strong ? deptName(strong.id) : "最强的系") + "。" + (weak && strong && weak.id !== strong.id ? deptName(weak.id) + "更没人管。" : ""));
    } else {
      addStat(state, "heat", -6);
      addStat(state, "compliance", 3);
      addStat(state, "reputation", 1);
      note(state, "账面交上去了。风险下去一点。收过的信封还在。");
    }
    state.scene = null;
    state.queue = [];
    state.phase = "play";
    sync(state);
  }

  function chronicleOf(state) {
    if (!state.chronicle) {
      const prior = (state.yearNotes || []).slice();
      state.chronicle = prior.length ? [{ year: state.year || 1, notes: prior }] : [];
    }
    const year = state.year || 1;
    const last = state.chronicle[state.chronicle.length - 1];
    if (!last || last.year !== year) state.chronicle.push({ year: year, notes: [] });
    return state.chronicle;
  }

  function note(state, text) {
    state.log.unshift(text);
    state.log = state.log.slice(0, 8);
    if (!state.yearNotes) state.yearNotes = [];
    const chronicle = chronicleOf(state);
    state.yearNotes.push(text);
    chronicle[chronicle.length - 1].notes.push(text);
  }

  function markOpening(state) {
    state.opening = {
      score: state.score,
      academic: state.academic,
      teaching: state.teaching,
      reputation: state.reputation,
      funds: state.funds,
      compliance: state.compliance,
      heat: state.heat,
      wound: state.wound,
      international: state.international,
      enrollment: state.enrollment || 0,
      reports: state.reports || 0,
      depts: state.depts.map((d) => ({ id: d.id, strength: d.strength }))
    };
    state.yearNotes = [];
    state.pushedJobs = false;
  }

  function deptName(id) {
    const meta = DEPTS.find((d) => d.id === id);
    return meta ? meta.name : "";
  }

  function rememberProf(state, teacher, act) {
    if (!state.story || !teacher || teacher.id !== state.story.profId) return;
    if (state.story.profAct === "reported" && act === "left") return;
    state.story.profAct = act;
  }

  function impact(state) {
    const g = Object.fromEntries(state.depts.map((d) => [d.id, d.strength]));
    const mods = { academic: 0, teaching: 0, reputation: 0, funds: 0, international: 0, compliance: 0 };
    const lines = [];

    mods.academic += Math.round((g.sci - 45) * 0.14);
    mods.academic += Math.round((g.eng - 40) * 0.05);
    mods.academic += Math.round((g.cs - 40) * 0.06);
    mods.international += Math.round((g.cs - 38) * 0.1);
    mods.reputation += Math.round((g.eng - 42) * 0.04);
    mods.funds += Math.round((g.biz - 34) * 0.28);
    mods.reputation += Math.round((g.biz - 45) * 0.03);
    mods.reputation += Math.round((g.hum - 40) * 0.09);
    mods.teaching += Math.round((g.hum - 36) * 0.05);
    mods.reputation += Math.round((g.med - 36) * 0.11);
    mods.academic += Math.round((g.med - 50) * 0.03);

    if (g.sci < 36) lines.push("理学还弱，学术增速被压着，升格材料里会被追问。");
    else if (g.sci >= 60) lines.push("理学站住了，更高一档的学术账本能往下写。");
    if (g.cs >= 58) lines.push("计算机把国际合作和论文一起带起来了。");
    if (g.biz >= 55) lines.push("经管强，校友和横向经费这一年比较松动。");
    else if (g.biz < 28) lines.push("经管太弱，学校自己几乎攒不出建设的钱。");
    if (g.med < 24) lines.push("医学垫底，社会服务在评估里被单列成问题。");
    if (g.hum >= 62 && leverageTeachers(state).length) lines.push("文法很强，把柄留在校园里，更不容易被按住。");

    const strengths = state.depts.map((d) => d.strength);
    const min = Math.min(...strengths);
    const max = Math.max(...strengths);
    if (min < 22) {
      mods.reputation -= 3;
      const weak = state.depts.find((d) => d.strength === min);
      const meta = DEPTS.find((d) => d.id === weak.id);
      lines.push(meta.name + "是最短的那块板，综合评估会反复提到它。");
    }
    if (max >= 78 && min <= 30) lines.push("一系独大，学校开始像被一个学院牵着走。");
    if (!lines.length) lines.push("六个系这一年没有谁拖垮整所学校。");
    return { mods, lines };
  }

  function computeScore(state) {
    const hit = impact(state).mods;
    const raw =
      state.academic * 0.22 +
      state.teaching * 0.14 +
      state.reputation * 0.14 +
      avgDept(state) * 0.32 +
      state.international * 0.1 +
      state.compliance * 0.08 +
      hit.academic * 0.2 +
      hit.reputation * 0.12 -
      state.heat * 0.15 -
      state.wound;
    return clamp(raw, 0, 100);
  }

  function rankScore(state) {
    return state.international * 0.5 + state.academic * 0.3 + state.reputation * 0.12 + avgDept(state) * 0.16;
  }

  function worldBand(score) {
    const bands = [
      [22, "未入榜"],
      [30, "1000 名开外"],
      [38, "801–1000"],
      [46, "501–800"],
      [54, "301–500"],
      [62, "201–300"],
      [70, "101–200"],
      [78, "51–100"]
    ];
    for (let i = 0; i < bands.length; i++) if (score < bands[i][0]) return { label: bands[i][1], index: i };
    return { label: "前 50", index: 8 };
  }

  function regionBand(score) {
    const s = score + 14;
    if (s < 36) return "未入区域榜";
    if (s < 48) return "区域 201–300";
    if (s < 58) return "区域前 200";
    if (s < 68) return "区域前 100";
    if (s < 78) return "区域前 50";
    return "区域前 20";
  }

  function rememberRank(state) {
    const band = worldBand(rankScore(state));
    if (band.index > state.bestRank) state.bestRank = band.index;
  }

  const BUILDINGS = [
    { id: "teach", name: "教学楼", cost: 10, detail: "教学 +3" },
    { id: "dorm", name: "宿舍", cost: 8, detail: "能多住 800 人" },
    { id: "train", name: "实训楼", cost: 14, detail: "工学 +4，教学 +2" },
    { id: "lab", name: "实验楼", cost: 16, detail: "理学 +4，学术 +3" },
    { id: "lib", name: "图书馆", cost: 12, detail: "学术 +4" },
    { id: "industry", name: "产教基地", cost: 16, detail: "以后每年经费 +40万，较弱的工学或经管 +3" },
    { id: "gym", name: "体育馆", cost: 8, detail: "声誉 +3。人超员时，风纪少掉一点" },
    { id: "intl", name: "国际交流中心", cost: 18, detail: "国际影响 +6", academic: true },
    { id: "hospital", name: "附属医院", cost: 22, detail: "医学 +8，声誉 +3，以后每年经费 -30万" },
    { id: "admin", name: "行政楼", cost: 10, detail: "风纪 +3，把柄风险 +4" }
  ];
  const MASTER_DEPTS = ["eng", "cs", "med", "biz"];

  function campusOf(state) {
    if (!state.campus) {
      state.campus = {
        mu: 240,
        students: 4000,
        buildings: {},
        pending: null
      };
    }
    const buildings = state.campus.buildings || (state.campus.buildings = {});
    BUILDINGS.forEach(function (b) {
      if (buildings[b.id] == null) buildings[b.id] = b.id === "teach" || b.id === "dorm" ? 1 : 0;
    });
    if (!state.masterPoints) state.masterPoints = [];
    if (state.bachelorAt == null) state.bachelorAt = 0;
    return state.campus;
  }

  function buildingById(id) {
    return BUILDINGS.find(function (b) { return b.id === id; }) || null;
  }

  function buildingCount(state, id) {
    return campusOf(state).buildings[id] || 0;
  }

  function capacityOf(state) {
    const campus = campusOf(state);
    return buildingCount(state, "dorm") * 800 + Math.floor(campus.mu / 100) * 1000;
  }

  function isDual(teacher) {
    return !!(teacher && (teacher.dual || teacher.skill === "class" || teacher.skill === "enroll" || teacher.skill === "rule"));
  }

  function dualCount(state, deptId) {
    return state.teachers.filter(function (t) {
      return isDual(t) && (!deptId || t.dept === deptId);
    }).length;
  }

  function gradCount(state) {
    return state.teachers.filter(function (t) { return (t.pedigree || 0) >= 1; }).length;
  }

  function yearsAsBachelor(state) {
    if (state.tier < 1 || !state.bachelorAt) return 0;
    return state.year - state.bachelorAt;
  }

  function masterBuilding(deptId) {
    if (deptId === "med") return { id: "hospital", label: "附属医院" };
    if (deptId === "biz") return { id: "industry", label: "产教基地" };
    return { id: "train", label: "实训楼" };
  }

  function pathGates(state, track) {
    const g = Object.fromEntries(state.depts.map((d) => [d.id, d.strength]));
    const readyDepts = state.depts.filter((d) => d.strength >= 32).length;
    const min = Math.min(...state.depts.map((d) => d.strength));
    const campus = campusOf(state);
    if (track === "vocational") {
      return {
        title: "职业本科",
        cost: 14,
        items: [
          item("综合评分", state.score, 36),
          item("教学", state.teaching, 48),
          item("风纪", state.compliance, 58),
          item("报考热度", state.enrollment || 0, 34),
          item("经费", state.funds, 14),
          item("工学或计算机达到 40", Math.max(g.eng, g.cs), 40),
          item("双师", dualCount(state), 4),
          item("占地（亩）", campus.mu, 360),
          item("实训楼", buildingCount(state, "train"), 1),
          item("产教基地", buildingCount(state, "industry"), 1),
          item("宿舍", buildingCount(state, "dorm"), 2),
          item("把柄风险", state.heat, 36, true),
          item("实名举报次数", state.reports || 0, 1, true),
          clearLoanItem(state)
        ]
      };
    }
    return {
      title: "普通本科",
      cost: 16,
      items: [
        item("综合评分", state.score, 40),
        item("教学", state.teaching, 42),
        item("四个系达到 32", readyDepts, 4),
        item("风纪", state.compliance, 50),
        item("最短的系不低于 18", min, 18),
        item("报考热度", state.enrollment || 0, 30),
        item("经费", state.funds, 16),
        item("理学", g.sci, 28),
        item("硕博教师", gradCount(state), 4),
        item("占地（亩）", campus.mu, 480),
        item("教学楼", buildingCount(state, "teach"), 2),
        item("实验楼", buildingCount(state, "lab"), 1),
        item("图书馆", buildingCount(state, "lib"), 1),
        item("宿舍", buildingCount(state, "dorm"), 2),
        item("实名举报次数", state.reports || 0, 1, true),
        clearLoanItem(state)
      ]
    };
  }

  function clearLoanItem(state) {
    return item("没有未还的贷款", state.loanYears ? 0 : 1, 1);
  }

  function masterGates(state, deptId) {
    const need = masterBuilding(deptId);
    const dept = deptById(state, deptId);
    return {
      title: deptName(deptId) + "专业硕士点",
      cost: 16,
      items: [
        item("办学年限", yearsAsBachelor(state), 3),
        item(deptName(deptId), dept ? dept.strength : 0, 62),
        item(need.label, buildingCount(state, need.id), 1),
        item("行业导师", dualCount(state, deptId), 2),
        item("风纪", state.compliance, 60),
        item("把柄风险", state.heat, 30, true),
        item("经费", state.funds, 16),
        clearLoanItem(state)
      ]
    };
  }

  function gates(state) {
    const g = Object.fromEntries(state.depts.map((d) => [d.id, d.strength]));
    const others = ["eng", "cs", "biz", "hum", "med"].filter((id) => g[id] >= 56).length;
    const strong = state.depts.filter((d) => d.strength >= 60).length;
    const campus = campusOf(state);
    if (state.tier <= 0 || state.track === "vocational") return null;
    if (state.tier === 1) {
      return {
        title: "212",
        cost: 18,
        items: [
          item("综合评分", state.score, 44),
          item("学术", state.academic, 36),
          item("理学", g.sci, 50),
          item("另有一个强系", others, 1),
          item("国际影响", state.international, 22),
          item("风纪", state.compliance, 55),
          item("把柄风险", state.heat, 41, true),
          item("举报创伤", state.wound, 11, true),
          item("报考热度", state.enrollment || 0, 34),
          item("经费", state.funds, 18),
          item("占地（亩）", campus.mu, 600),
          item("实验楼", buildingCount(state, "lab"), 1),
          item("图书馆", buildingCount(state, "lib"), 1),
          item("国际交流中心", buildingCount(state, "intl"), 1),
          clearLoanItem(state)
        ]
      };
    }
    if (state.tier === 2) {
      const items = [
        item("综合评分", state.score, 66),
        item("学术", state.academic, 64),
        item("理学", g.sci, 60),
        item("三个系达到 60", strong, 3),
        item("国际影响", state.international, 40),
        item("风纪", state.compliance, 62),
        item("把柄风险", state.heat, 29, true),
        item("举报创伤", state.wound, 9, true),
        item("实名举报次数", state.reports, 2, true),
        item("经费", state.funds, 22),
        item("占地（亩）", campus.mu, 800),
        item("实验楼", buildingCount(state, "lab"), 2),
        item("图书馆", buildingCount(state, "lib"), 1)
      ];
      if (g.med >= 40) items.push(item("附属医院", buildingCount(state, "hospital"), 1));
      items.push(clearLoanItem(state));
      return { title: "986", cost: 22, items: items };
    }
    if (state.tier === 3) {
      const eliteDepts = state.depts.filter((d) => d.strength >= 66).length;
      return {
        title: "D9",
        cost: 28,
        items: [
          item("综合评分", state.score, 78),
          item("学术", state.academic, 74),
          item("理学", g.sci, 72),
          item("四个系达到 66", eliteDepts, 4),
          item("国际影响", state.international, 56),
          item("风纪", state.compliance, 70),
          item("把柄风险", state.heat, 21, true),
          item("举报创伤", state.wound, 7, true),
          item("实名举报次数", state.reports, 1, true),
          item("经费", state.funds, 28),
          item("占地（亩）", campus.mu, 1000),
          item("国际交流中心", buildingCount(state, "intl"), 1),
          clearLoanItem(state)
        ]
      };
    }
    return null;
  }

function wan(n) {
  return Math.round(Number(n) * 10) + "万";
}

function wanSigned(n) {
  const v = Math.round(Number(n) * 10);
  return (v > 0 ? "+" : "") + v + "万";
}

function item(label, value, need, below) {
  const ok = below ? value < need : value >= need;
  const show = label === "经费" ? wan : function (n) { return String(Math.round(n)); };
  const shown = below
    ? show(value) + " / 低于 " + show(need)
    : show(value) + " / " + show(need);
  return { label, ok, shown, value: value, need: need, below: !!below };
}

  function gateReady(state) {
    const g = gates(state);
    return g && g.items.every((it) => it.ok);
  }

  function sync(state) {
    state.score = computeScore(state);
    rememberRank(state);
  }

  function bumpDept(state, id, n) {
    const d = deptById(state, id);
    if (d) d.strength = clamp(d.strength + n, 0, 100);
  }

  function addStat(state, key, n, min, max) {
    state[key] = clamp(state[key] + n, min == null ? 0 : min, max == null ? 100 : max);
  }

  function giveLeverage(state, teacher, heat) {
    teacher.leverage = true;
    teacher.loyalty = clamp(teacher.loyalty + 8, 0, 100);
    addStat(state, "heat", heat);
    addStat(state, "compliance", -Math.round(heat * 0.45));
    state.bribes += 1;
  }

  function removeTeacher(state, teacher, deptDrop) {
    rememberProf(state, teacher, "left");
    if (state.chairOf && state.chairOf[teacher.dept] === teacher.id) delete state.chairOf[teacher.dept];
    bumpDept(state, teacher.dept, deptDrop);
    state.teachers = state.teachers.filter((t) => t.id !== teacher.id);
    state.resigns += 1;
  }

  function reportPlayer(state, teacher, wound) {
    rememberProf(state, teacher, "reported");
    state.reports += 1;
    state.wound = clamp(state.wound + wound, 0, 40);
    addStat(state, "reputation", -8);
    addStat(state, "heat", 18);
    addStat(state, "compliance", -6);
    if (teacher) teacher.leverage = false;
    sync(state);
  }

  function scene(title, body, choices, extra) {
    return Object.assign({ title, body, choices }, extra || {});
  }

  function cont(label) { return [{ id: "cont", label: label || "继续" }]; }

  function openQueue(state, items) {
    state.queue = items.filter(Boolean);
    state.scene = state.queue.shift() || null;
    state.phase = state.scene ? "scene" : "play";
  }

  function nextScene(state) {
    state.scene = state.queue.shift() || null;
    if (state.scene) {
      state.phase = state.phase === "season" || state.phase === "year-events" ? state.phase : "scene";
      return;
    }
    if (state.phase === "season") {
      state.season = (state.season || 0) + 1;
      state.actionsLeft = 1;
      state.phase = "play";
      return;
    }
    if (state.phase === "year-events" || state.afterEvents) {
      state.afterEvents = false;
      settleYear(state);
      return;
    }
    state.phase = "play";
  }

  function applyAction(state) {
    if (state.applyBlockYear === state.year) {
      return { id: "apply", name: "今年不能申报", desc: "机电校并进来的下一年，材料先不收。", cost: 0, once: true, disabled: true };
    }
    if (state.tier <= 0) {
      return { id: "apply", name: "申报升本", desc: "两条路。普通本科可以继续到 212、986、D9。职业本科升完就封顶。", cost: 0, once: true };
    }
    if (state.track === "vocational") {
      const n = (state.masterPoints || []).length;
      if (n >= 2) return { id: "apply", name: "专业硕士点已满", desc: "两个点都在。整合去找政府。212 不会再收。", cost: 0, once: true, disabled: true };
      return { id: "apply", name: "申报专业硕士点", desc: "职业本科办满三年后，点落在工学、计算机、医学或经管。", cost: 0, once: true };
    }
    const g = gates(state);
    if (!g) return { id: "apply", name: "已是 D9", desc: "这一档已经到顶。", cost: 0, once: true, disabled: true };
    return { id: "apply", name: "申报" + g.title, desc: "过了：" + tierPrize(state.tier + 1).lines.join("，") + "。省里按这一档送评。把柄不动。", cost: g.cost, once: true };
  }

  function campusBlurb(state) {
    const pending = campusOf(state).pending;
    if (pending) {
      const spec = buildingById(pending);
      return (spec ? spec.name : "一座楼") + "还没交付。明年春天才能再开工。";
    }
    return "花钱盖楼。地要找政府要。今年一座，明年春天交付。";
  }

  function actionsCatalog(state) {
    const focus = teachFocus(state);
    const cs = deptById(state, "cs").strength;
    const apply = applyAction(state);
    return [
      { id: "build", name: "学科建设", desc: "一年只建一个系。点到的厚，旁边有的系会薄。", cost: 8, once: true },
      { id: "campus", name: "基建", desc: campusBlurb(state), cost: 0, once: true },
      { id: "recruit", name: "引进人才", desc: "出身和擅长决定拉动哪一项。学校越高，好出身越多，拉动越大。贪的来做副教授。", cost: 14, once: false },
      { id: "world", name: "国际合作", desc: cs >= 50 ? "交换、联培，榜单上能看见的那种。" : "计算机还不够强，签了也更像访问。", cost: 10, once: false },
      { id: "donate", name: "校友募捐", desc: "经费进来。最短的系薄一截。", cost: 0, once: true, free: true },
      { id: "office", name: "校长办公会", desc: "经费、处分或一份文件，只能拍一件。", cost: 0, once: true, free: true },
      { id: "gov", name: "找政府", desc: "要专项、名额或一块地。职业本科之后还可以请示整合。", cost: 0, once: true, free: true },
      { id: "students", name: "学生事务", desc: "处分或就业。今年不在学生面前出现，舆论会更重。", cost: 0, once: true, free: true },
      { id: "inspect", name: "内部巡察", desc: "想把把柄切掉。对方也会察觉。", cost: 4, once: true },
      { id: "teach", name: "教学评估", desc: focus.id === "teaching" ? "补升本最看的教学。学术不动。" : "补" + focus.label + "。教学不动。", cost: 6, once: true },
      { id: "project", name: "报课题", desc: state.tier < 1 ? "升本之后才能报。可能失败。" : "占一季。要强系、楼和牵头人。成了留下一个有名字的成果，败了人和钱都伤。", cost: 0, once: true, disabled: state.tier < 1 },
      apply
    ];
  }

  function perform(state, id, arg) {
    const spec = actionsCatalog(state).find((a) => a.id === id);
    if (!spec || spec.disabled) return;
    if (!spec.free && state.actionsLeft <= 0) return;
    if (spec.once && state.used[id]) {
      openQueue(state, [scene("今年做过了", "同一件事一年只办一次。", cont("返回"))]);
      return;
    }
    if (state.funds < spec.cost) {
      openQueue(state, [scene("经费不够", "账上盖不住这次开支。先去募捐，或者换一件事。", cont("返回"))]);
      return;
    }
    if ((id === "build" || id === "recruit" || id === "project") && !arg) {
      openQueue(state, [deptPick(state, id)]);
      return;
    }
    if (id === "project") return doProject(state, arg);
    if (id === "apply") return doApply(state);
    if (id === "campus") return openCampus(state);
    if (id === "office") return openOffice(state);
    if (id === "gov") return openGov(state);
    if (id === "students") return openStudents(state);
    if (id === "build") return doBuild(state, arg);
    if (id === "recruit") return doRecruit(state, arg);
    if (id === "world") return doWorld(state);
    if (id === "donate") return doDonate(state);
    if (id === "inspect") return doInspect(state);
    if (id === "teach") return doTeach(state);
  }

  function isFreeAction(id) {
    return id === "donate" || id === "office" || id === "gov" || id === "students";
  }

  function spendAction(state, id, cost) {
    state.funds -= cost;
    state.used[id] = true;
    if (!isFreeAction(id)) state.actionsLeft -= 1;
  }

  function finishAction(state, card) {
    if (state.actionsLeft > 0) {
      openQueue(state, [card]);
      return;
    }
    if ((state.season || 0) < 3) {
      openQueue(state, [card]);
      state.phase = "season";
      return;
    }
    state.afterEvents = true;
    const events = yearEvents(state);
    state.queue = [card].concat(events).filter(Boolean);
    state.scene = state.queue.shift() || null;
    state.phase = "year-events";
    if (!state.scene) settleYear(state);
  }

  function recruitOddsLine(tier) {
    if (tier <= 0) return "现在是大专。人多半从本校或普通学院来，拉动小。";
    if (tier === 1) return "现在是本科。普通大学的博士会多起来，拉动比大专大。";
    if (tier === 2) return "现在是 212。986 和海外博士开始常见，拉动更大。";
    if (tier === 3) return "现在是 986。海外和 986 的博士最常见，拉动更大。";
    return "现在是 D9。海外博士最常见，拉动最大。";
  }

  function deptPick(state, action) {
    return scene(
      action === "build" ? "建设哪个系" : action === "project" ? "课题挂在哪个系" : "人才引进到哪个系",
      action === "build"
        ? "每个系影响的东西不一样。理学卡升格，计算机拉排名，经管出钱，医学太弱会被点名，文法会把舆论放大。系过了 60，同样的名额加得少。"
        : action === "project"
          ? "要这个系够强，还要实验楼或实训楼，以及一位能牵头的人。可能失败。"
          : recruitOddsLine(state.tier) + "擅长科研抬学术，上课抬教学，国际抬国际影响，招生抬报考，学工抬风纪。",
      state.depts.map((d) => {
        const meta = DEPTS.find((x) => x.id === d.id);
        const empty = deptTeachers(state, d.id).length ? "" : " · 没有带头人";
        const cheap = action === "build" && state.policy === "major" && state.policyDept === d.id ? " · 建设退回 " + wan(4) : "";
        return { id: "pick:" + action + ":" + d.id, label: meta.name + "  " + d.strength, detail: meta.role + empty + cheap };
      }).concat([{ id: "cont", label: "返回" }])
    );
  }

  function neglectDrops(focusId) {
  const stem = focusId === "sci" || focusId === "cs" || focusId === "eng";
  if (stem) return { hum: 4, med: 4 };
  if (focusId === "biz") return { sci: 4, cs: 2 };
  return { sci: 4, eng: 2 };
}

  function buildGain(strength) {
    if (strength >= 80) return 3;
    if (strength >= 60) return 5;
    return 8;
  }

function doBuild(state, deptId) {
    const dept = deptById(state, deptId);
    const gain = buildGain(dept ? dept.strength : 0);
    const cheap = state.policy === "major" && state.policyDept === deptId;
    spendAction(state, "build", 8);
    if (cheap) state.funds = clamp(state.funds + 4, 0, 220);
    bumpDept(state, deptId, gain);
    const meta = DEPTS.find((d) => d.id === deptId);
    const drops = neglectDrops(deptId);
    const dropped = [];
    Object.keys(drops).forEach((id) => {
      bumpDept(state, id, -drops[id]);
      const name = DEPTS.find((d) => d.id === id).name;
      dropped.push(name + " -" + drops[id]);
    });
    if (deptId === "sci" || deptId === "eng" || deptId === "cs") addStat(state, "academic", 3);
    else addStat(state, "teaching", 2);
    if (deptId === "med") addStat(state, "reputation", 2);
    note(state, "建设名额进了" + meta.name + " +" + gain + "。" + (cheap ? "调整名单上的系，退回 " + wan(4) + "。" : "") + dropped.join("，") + "。");
    sync(state);
    const thin = gain < 8 ? "这个系已经不薄，同样的名额只加了 " + gain + "。" : "";
    finishAction(state, scene(
      meta.name + "动起来了",
      "一年只有一个名额。这一次 +" + gain + "。" + (cheap ? "调整名单退回 " + wan(4) + "。" : "") + thin + "没排上的系没人管：" + dropped.join("，") + "。",
      cont()
    ));
  }

  function hireEffect(teacher) {
    const pedigree = teacher.pedigree || 0;
    const skill = skillById(teacher.skill);
    return {
      dept: 2 + pedigree + (teacher.rank >= 2 ? 2 : 0),
      skill,
      skillStep: 1 + pedigree
    };
  }

  function doRecruit(state, deptId) {
    spendAction(state, "recruit", 14);
    const greed = rand(100);
    const greedy = greed >= 72;
    const teacher = makeTeacher(deptId, { talent: 68 + rand(28), greed, rank: greedy ? 2 : 1 }, state.tier);
    state.teachers.push(teacher);
    const meta = DEPTS.find((d) => d.id === deptId);
    const effect = hireEffect(teacher);
    bumpDept(state, deptId, effect.dept);
    addStat(state, effect.skill.stat, effect.skillStep);
    const who = teacher.name + "，" + teacher.school + teacher.degree + "，擅长" + effect.skill.name + "。";
    const moved = meta.name + " +" + effect.dept + "，" + effect.skill.label + " +" + effect.skillStep + "。";
    const audit = "把柄风险 +6，风纪 -3。";
    if (greedy) {
      addStat(state, "heat", 6);
      addStat(state, "compliance", -3);
      note(state, who + "以副教授引进" + meta.name + "。" + moved + audit);
    } else {
      note(state, who + "以讲师引进" + meta.name + "。" + moved);
    }
    sync(state);
    finishAction(state, scene(
      greedy ? "副教授来了，账不好看" : "引进了一位讲师",
      greedy
        ? who + "以副教授进了" + meta.name + "。" + moved + audit + "教授要以后评。"
        : who + "以讲师进了" + meta.name + "。" + moved + "没有留下不好审计的账。",
      cont()
    ));
  }

  function dossier(teacher) {
    const work = teacher.talent >= 62 ? "成果够" : teacher.talent >= 45 ? "成果勉强" : "成果不够";
    const money = teacher.greed >= 70 ? "夹着信封" : teacher.greed >= 50 ? "话里有话" : "材料是干的";
    return work + "，" + money + (teacher.leverage ? "，握有把柄" : "");
  }

  function reviewCard(teacher) {
    const meta = DEPTS.find((d) => d.id === teacher.dept);
    if (teacher.leverage) {
      return scene(
        teacher.name + "来要一个结果",
        "他已经握着你收过钱的那件事。这次不是商量，是要求把他的" + RANKS[Math.min(3, teacher.rank + 1)] + "直接写进名单。",
        [
          { id: "help:" + teacher.id, label: "帮他过", detail: "他留下，系会更强，学术水分和风险一起上去" },
          { id: "refuse:" + teacher.id, label: "不帮", detail: "他可能离职，也可能举报。举报会伤学校评分" }
        ]
      );
    }
    if (teacher.greed >= 58) {
      return scene(
        "材料下面还有一个信封",
        meta.name + "的" + teacher.name + "差一截成果。他说这笔钱可以进学校的发展账户，评审记录上不会出现你的名字。门没有关严。",
        [
          { id: "clean:" + teacher.id, label: "按学术标准办", detail: talentLine(teacher) },
          { id: "take:" + teacher.id, label: "收下，并让他过", detail: "经费增加，把柄留在他手里" }
        ]
      );
    }
    return scene(
      teacher.name + "的材料是干的",
      "没有额外的话。评不评，只看成果够不够。",
      [
        { id: "clean:" + teacher.id, label: "进入评审", detail: talentLine(teacher) },
        { id: "skip:" + teacher.id, label: "今年不评他", detail: "名额留给别人，他会不高兴" }
      ]
    );
  }

  function meetingCandidates(state, deptId) {
    const meta = DEPTS.find((d) => d.id === deptId);
    const shown = deptTeachers(state, deptId).filter((t) => t.rank < 3).sort((a, b) => b.talent - a.talent).slice(0, 3);
    if (!shown.length) return scene(meta.name + "没有可评的人", "这个系的人都已经是教授。职称不往下降。", cont());
    return scene(
      meta.name + "职称评审",
      "名额只有一个。材料上写着成果，也写着这个人会不会把信封夹进来。",
      shown.map((t) => ({
        id: "meet:" + t.id,
        label: t.name + " · " + RANKS[t.rank],
        detail: dossier(t)
      }))
    );
  }

  function promotionMeeting(state) {
    const choices = DEPTS.map((meta) => {
      const waiting = deptTeachers(state, meta.id).filter((t) => t.rank < 3).length;
      return {
        id: "reviewdept:" + meta.id,
        label: meta.name + "  " + deptById(state, meta.id).strength,
        detail: waiting ? waiting + " 人可评 · " + meta.role : "没有可评的人",
        waiting
      };
    }).filter((choice) => choice.waiting);
    if (!choices.length) return scene("今年没有可评的人", "在任的人都已经是教授。职称不往下降。", cont());
    return scene(
      "今年评哪个系",
      "双年的名额只有一个。评谁，这个系就会动一动；没评的系，今年靠建设名额。",
      choices.map((choice) => ({ id: choice.id, label: choice.label, detail: choice.detail }))
    );
  }

  function talentLine(teacher) {
    if (teacher.talent >= 62) return "成果够，晋级能抬这个系，也能抬学术";
    if (teacher.talent >= 45) return "勉强够格，系会稳一点";
    return "成果偏弱，硬抬会伤学术";
  }

  function doWorld(state) {
    spendAction(state, "world", 10);
    const cs = deptById(state, "cs").strength;
    const gain = 8 + (cs >= 50 ? 3 : 0);
    addStat(state, "international", gain);
    addStat(state, "reputation", 2);
    note(state, "一批联培和学生交换写进了年鉴。");
    sync(state);
    finishAction(state, scene("榜单会看见这一笔", cs >= 50
      ? "计算机的合作方肯署名，国际影响抬得比较扎实。"
      : "协议签了。计算机还不够强的时候，这种合作更像访问，不太像成果。", cont()));
  }

  function doDonate(state) {
    spendAction(state, "donate", 0);
    const biz = deptById(state, "biz").strength;
    let money = 12 + Math.round((biz - 30) * 0.2);
    if (state.policy === "tight") money = Math.max(4, Math.round(money * 0.6));
    state.funds = clamp(state.funds + money, 0, 220);
    const weak = state.depts.slice().sort((a, b) => a.strength - b.strength)[0];
    const weakName = DEPTS.find((d) => d.id === weak.id).name;
    bumpDept(state, weak.id, -4);
    note(state, "校友这一年进来 " + wan(money) + "。" + (state.policy === "tight" ? "拨款收紧，这笔比往常少。" : "") + weakName + "薄了 4。");
    sync(state);
    finishAction(state, scene(
      "钱是干净的",
      "经管越强，这份名单越好看。没有信封。这一年少做的那件事，落在最短的" + weakName + "上。",
      cont()
    ));
  }

  function teachFocus(state) {
    if (state.tier <= 0) return { id: "teaching", label: "教学", value: state.teaching };
    const sci = deptById(state, "sci").strength;
    return [
      { id: "academic", label: "学术", value: state.academic },
      { id: "sci", label: "理学", value: sci },
      { id: "compliance", label: "风纪", value: state.compliance },
      { id: "international", label: "国际影响", value: state.international }
    ].sort((a, b) => a.value - b.value)[0];
  }

  function doTeach(state) {
    spendAction(state, "teach", 6);
    const focus = teachFocus(state);
    if (focus.id === "teaching") {
      addStat(state, "teaching", 8);
      addStat(state, "reputation", 2);
      note(state, "教学评估过了一轮。学术没有动。");
      sync(state);
      finishAction(state, scene("课堂被看过了", "教学抬了一截。升本看的就是这个。学术这一栏不动。", cont()));
      return;
    }
    if (focus.id === "sci") bumpDept(state, "sci", 5);
    else addStat(state, focus.id, focus.id === "international" ? 5 : 6);
    note(state, "评估改去补" + focus.label + "。教学没有动。");
    sync(state);
    finishAction(state, scene("评估改了方向", focus.label + "抬了一截。教学这一栏不动。", cont()));
  }

  function doInspect(state) {
    spendAction(state, "inspect", 4);
    state.inspections += 1;
    addStat(state, "compliance", 12);
    addStat(state, "heat", -16);
    const held = leverageTeachers(state);
    let body = "巡察组在校园里走了一圈。风纪回升，有些话头被压了下去。";
    if (held.length) {
      const teacher = pick(held);
      if (Math.random() < 0.42) {
        teacher.leverage = false;
        teacher.loyalty = clamp(teacher.loyalty - 25, 0, 100);
        body = teacher.name + "手里的那件事暂时被程序盖过去了。他知道是你在切割，人还在，信任没了。";
        if (Math.random() < 0.35) {
          removeTeacher(state, teacher, -7);
          body += "年底他走了，带走一个方向，没有把信递出去。";
        }
      } else {
        body = teacher.name + "察觉你在切割。把柄还在。下次他来找而你不帮，举报会更重。";
        teacher.loyalty = clamp(teacher.loyalty - 10, 0, 100);
      }
    }
    note(state, "内部巡察走完一轮。");
    sync(state);
    finishAction(state, scene("巡察结束", body, cont()));
  }

  function otherStrong(state, id) {
    return state.depts.filter((d) => d.id !== id).sort((a, b) => b.strength - a.strength)[0];
  }

  function openOffice(state) {
    openQueue(state, [scene(
      "校长办公会",
      "今天只能拍一件。经费、处分、一份还没签的文件，动了哪件，另一边就要让。",
      [
        { id: "office:tilt", label: "经费倾向一个系", detail: "那个系厚一截，最强的另一个系薄一截" },
        { id: "office:punish", label: "压下一份处分", detail: "报考上去，风纪下去" },
        { id: "office:file", label: "文件先压着", detail: "没有系被削。事情还在桌上，风险上去，声誉掉一点" }
      ].concat([{ id: "cont", label: "返回" }])
    )]);
  }

  function officePick(state) {
    return scene(
      "经费倾向哪个系",
      "厚的是它。最强的另一个系要让出一截。",
      state.depts.map((d) => {
        const meta = DEPTS.find((x) => x.id === d.id);
        return { id: "office-dept:" + d.id, label: meta.name + "  " + d.strength, detail: meta.role };
      }).concat([{ id: "office:back", label: "返回" }])
    );
  }

  function doOfficeTilt(state, deptId) {
    spendAction(state, "office", 0);
    const meta = DEPTS.find((d) => d.id === deptId);
    const other = otherStrong(state, deptId);
    const otherName = DEPTS.find((d) => d.id === other.id).name;
    bumpDept(state, deptId, 6);
    bumpDept(state, other.id, -4);
    note(state, "办公会把经费倾向" + meta.name + "。" + otherName + "薄了 4。");
    sync(state);
    finishAction(state, scene(meta.name + "拿到了这笔", otherName + "是现在最强的另一个系，会上让出了一截。", cont()));
  }

  function doOfficePunish(state) {
    spendAction(state, "office", 0);
    addStat(state, "enrollment", 4);
    addStat(state, "compliance", -6);
    note(state, "一份处分被压下。报考上来，风纪下去。");
    sync(state);
    finishAction(state, scene("处分没有发出去", "学生还在。报考热度上来了。风纪那一栏不好看。", cont()));
  }

  function doOfficeFile(state) {
    spendAction(state, "office", 0);
    addStat(state, "heat", 6);
    addStat(state, "reputation", -3);
    note(state, "一份文件压在桌上。没有系被削，风险上去了。");
    sync(state);
    finishAction(state, scene("先不签", "会上没有点名哪个系，也没有动处分。事情还在。外面已经有人在问这份文件。", cont()));
  }

  function openGov(state) {
    const choices = [
      { id: "gov:money", label: "要一笔专项", detail: "经费进来，把柄风险上去" },
      { id: "gov:build", label: "要一个建设名额", detail: "一个系厚一截，风险也上去。不花学校自己的建设费" },
      { id: "gov:land", label: "要一块地", detail: "占地 +80 亩，把柄风险上去。钱买不来" }
    ];
    if (state.track === "vocational" && state.tier >= 1 && !state.merged) {
      choices.push({ id: "gov:merge", label: "请示整合", detail: state.funds >= 20 ? "吞并一所弱校。人、债和地一起进来" : "账上不到 " + wan(20) + "，现在不批" });
    }
    openQueue(state, [scene(
      "找政府",
      "专项、名额和地都能要。要到了，材料会被多看一眼。这和校友的钱不是一笔。",
      choices.concat([{ id: "cont", label: "返回" }]),
      { abortAction: true }
    )]);
  }

  function govPick(state) {
    return scene(
      "名额给哪个系",
      "政府的名额直接落到这个系。把柄风险一起记上。",
      state.depts.map((d) => {
        const meta = DEPTS.find((x) => x.id === d.id);
        return { id: "gov-dept:" + d.id, label: meta.name + "  " + d.strength, detail: meta.role };
      }).concat([{ id: "gov:back", label: "返回" }])
    );
  }

  function doGovMoney(state) {
    spendAction(state, "gov", 0);
    const gain = state.policy === "tight" ? 8 : 14;
    const heat = state.policy === "tight" ? 4 : 8;
    state.funds = clamp(state.funds + gain, 0, 220);
    addStat(state, "heat", heat);
    note(state, "专项经费进来 " + wan(gain) + "。" + (state.policy === "tight" ? "拨款收紧，风险轻一点。" : "材料会被多看一眼。"));
    sync(state);
    finishAction(state, scene("专项批了", "账上多了一笔。来路要写进汇报，把柄风险上去。", cont()));
  }

  function doGovLand(state) {
    spendAction(state, "gov", 0);
    const campus = campusOf(state);
    campus.mu += 80;
    addStat(state, "heat", state.policy === "tight" ? 3 : 6);
    note(state, "政府批了 80 亩。占地现在是 " + campus.mu + "。材料会被多看一眼。");
    sync(state);
    finishAction(state, scene("地批了", "占地 +80 亩，现在是 " + campus.mu + " 亩。把柄风险上去。亩数不能用学校自己的钱买。", cont()));
  }

  function addMergeStaff(state, deptId, count) {
    for (let i = 0; i < count; i++) {
      state.teachers.push(makeTeacher(deptId, {
        rank: i === 0 ? 2 : 1,
        talent: 30 + rand(25),
        greed: 60 + rand(40),
        dual: true
      }, state.tier));
    }
  }

  function doMerge(state, which) {
    if (state.merged || state.track !== "vocational" || state.tier < 1) return;
    if (state.funds < 20) {
      state.scene = scene("账上不够", "整合要先垫得出 " + wan(20) + "。这次不消耗行动。", cont("返回"), { abortAction: true });
      state.queue = [];
      return;
    }
    spendAction(state, "gov", 0);
    const campus = campusOf(state);
    let title = "";
    let body = "";
    if (which === "med") {
      state.funds = clamp(state.funds - 16, 0, 220);
      bumpDept(state, "med", 10);
      campus.mu += 80;
      campus.students += 600;
      addStat(state, "compliance", -8);
      addMergeStaff(state, "med", 4);
      state.mergeOffer = { dept: "med", gain: 10 };
      title = "卫校并进来了";
      body = "医学 +10，占地 +80。经费 -160万，风纪 -8，并入 4 个人。冬天要决定这些人留不留。";
    } else if (which === "eng") {
      bumpDept(state, "eng", 8);
      bumpDept(state, "hum", -4);
      campus.mu += 160;
      campus.students += 800;
      campus.buildings.dorm = (campus.buildings.dorm || 0) + 1;
      addStat(state, "heat", 8);
      addMergeStaff(state, "eng", 3);
      state.mergeOffer = { dept: "eng", gain: 8 };
      state.applyBlockYear = state.year + 1;
      title = "机电校并进来了";
      body = "工学 +8，占地 +160，宿舍 +1。文法 -4，把柄风险 +8。下一年不能申报。冬天要安置这批人。";
    } else {
      bumpDept(state, "biz", 8);
      addStat(state, "enrollment", 6);
      campus.mu += 100;
      campus.students += 400;
      state.wound = clamp(state.wound + 4, 0, 40);
      const weak = state.depts.slice().sort(function (a, b) { return a.strength - b.strength; })[0];
      bumpDept(state, weak.id, -4);
      addMergeStaff(state, "biz", 3);
      state.mergeOffer = { dept: "biz", gain: 8 };
      title = "财经校并进来了";
      body = "经管 +8，报考 +6，占地 +100。举报创伤 +4，" + deptName(weak.id) + " -4。冬天要安置这批人。";
    }
    state.merged = which;
    state.mergedThisYear = true;
    note(state, title + "。占地现在是 " + campus.mu + " 亩。");
    sync(state);
    finishAction(state, scene(title, body, cont()));
  }

  function doGovBuild(state, deptId) {
    spendAction(state, "gov", 0);
    const meta = DEPTS.find((d) => d.id === deptId);
    bumpDept(state, deptId, 6);
    addStat(state, "heat", state.policy === "tight" ? 3 : 6);
    note(state, "政府的建设名额进了" + meta.name + "。风险上去了。");
    sync(state);
    finishAction(state, scene(meta.name + "用了这个名额", "没有动学校自己的建设费。名额从上面来，看材料的人也会多看一眼。", cont()));
  }

  function openStudents(state) {
    openQueue(state, [scene(
      "学生事务",
      "食堂和校报都看过了。处分和就业，今天得有一个说法。今年要是不在学生面前出现，后面的舆论会更重。",
      [
        { id: "stu:punish", label: "按规矩处分", detail: "风纪上升，报考下去" },
        { id: "stu:jobs", label: "保就业", detail: "报考上升。账上够就出 " + wan(8) + "，不够声誉掉一点。出了账，年底就业好一档" }
      ].concat([{ id: "cont", label: "返回" }])
    )]);
  }

  function doStudents(state, how) {
    spendAction(state, "students", 0);
    state.facedStudents = true;
    if (how === "punish") {
      addStat(state, "compliance", 6);
      addStat(state, "enrollment", -4);
      note(state, "处分按规矩发出去了。风纪回来，报考掉了一截。");
      sync(state);
      finishAction(state, scene("处分发出去了", "你在场。风纪抬了一截，报考热度下去。", cont()));
      return;
    }
    if (state.funds >= 8) {
      state.funds -= 8;
      state.pushedJobs = true;
      note(state, "就业拨了 " + wan(8) + "。报考热度回来一点。年底就业好一档。");
    } else {
      addStat(state, "reputation", -3);
      note(state, "就业的场面摆了，钱没出去。声誉掉一点，年底不加档。");
    }
    addStat(state, "enrollment", 5);
    sync(state);
    finishAction(state, scene(
      "去保了就业",
      state.pushedJobs
        ? "你在招聘会上出现过。报考热度上来，账上少一笔。年底的就业会好一档。"
        : "你在招聘会上出现过。报考热度上来。账上不够，声誉掉一点，年底就业不加档。",
      cont()
    ));
  }

  function tierPrize(nextTier) {
    if (nextTier === 1) {
      return {
        grant: "省里按本科拨了一笔开办费。",
        lines: ["经费 +180万", "报考 +4"],
        apply: function (state) {
          state.funds = clamp(state.funds + 18, 0, 220);
          addStat(state, "enrollment", 4);
        }
      };
    }
    if (nextTier === 2) {
      return {
        grant: "212专项落到理学和国际合作上。",
        lines: ["理学 +6", "国际影响 +8", "经费 +120万"],
        apply: function (state) {
          bumpDept(state, "sci", 6);
          addStat(state, "international", 8);
          state.funds = clamp(state.funds + 12, 0, 220);
        }
      };
    }
    if (nextTier === 3) {
      return {
        grant: "抬头换成 986。",
        lines: ["国际影响 +10", "学术 +6", "声誉 +6"],
        apply: function (state) {
          addStat(state, "international", 10);
          addStat(state, "academic", 6);
          addStat(state, "reputation", 6);
        }
      };
    }
    return {
      grant: "D9的名额落到国际榜和学术上。",
      lines: ["国际影响 +8", "学术 +4", "声誉 +4"],
      apply: function (state) {
        addStat(state, "international", 8);
        addStat(state, "academic", 4);
        addStat(state, "reputation", 4);
      }
    };
  }

  function gapScene(title, items) {
    const missing = items.filter(function (it) { return !it.ok; }).map(function (it) { return it.label + " " + it.shown; });
    return scene(title, "还差：" + missing.join("；") + "。这次不消耗行动。", cont("返回"), { abortAction: true });
  }

  function doApply(state) {
    if (state.applyBlockYear === state.year) {
      openQueue(state, [scene("今年不能申报", "机电校并进来的下一年，材料先不收。", cont("返回"), { abortAction: true })]);
      return;
    }
    if (state.tier <= 0) {
      openQueue(state, [scene(
        "升本走哪条",
        "选完不能改。普通本科可以继续申报 212、986、D9。职业本科升完就封顶，后面只剩专业硕士点和一次整合。",
        [
          { id: "apply-track:academic", label: "普通本科", detail: "看理学、硕博师资、实验楼和图书馆。经费 " + wan(16) },
          { id: "apply-track:vocational", label: "职业本科", detail: "看工学或计算机、双师、实训楼和产教基地。经费 " + wan(14) },
          { id: "cont", label: "返回" }
        ],
        { abortAction: true }
      )]);
      return;
    }
    if (state.track === "vocational") {
      const left = MASTER_DEPTS.filter(function (id) { return state.masterPoints.indexOf(id) < 0; });
      openQueue(state, [scene(
        "专业硕士点落在哪",
        "不是 212。一个点占这一季，最多两个。办满三年、系和楼都够，才能递。",
        left.map(function (id) {
          const g = masterGates(state, id);
          const ready = g.items.every(function (it) { return it.ok; });
          return { id: "master-dept:" + id, label: deptName(id), detail: (ready ? "可以递。经费 " + wan(16) : "还有没到的") };
        }).concat([{ id: "cont", label: "返回" }]),
        { abortAction: true }
      )]);
      return;
    }
    const g = gates(state);
    if (!g) return;
    if (!gateReady(state)) {
      openQueue(state, [gapScene("材料还递不出去", g.items)]);
      return;
    }
    const prize = tierPrize(state.tier + 1);
    spendAction(state, "apply", g.cost);
    state.tier += 1;
    state.schoolName = fullName(state.baseName, state.tier, state.track);
    shiftRival(state, -8, "你们先升了一档。");
    prize.apply(state);
    note(state, "学校升到「" + TIERS[state.tier].name + "」。" + prize.lines.join("，") + "。");
    sync(state);
    const title = state.tier === 2 ? "进入 212 这一档" : state.tier === 3 ? "进入 986 这一档" : "进入 D9";
    finishAction(state, scene(title, prize.grant + "省里按这一档送评。" + prize.lines.join("，") + "。把柄没有洗掉。", cont()));
  }

  function commitBachelor(state, track) {
    const g = pathGates(state, track);
    if (!g.items.every(function (it) { return it.ok; })) {
      state.scene = gapScene(g.title + "还递不出去", g.items);
      state.queue = [];
      return;
    }
    if (state.funds < g.cost) {
      state.scene = scene("经费不够", "这条路要 " + wan(g.cost) + "。这次不消耗行动。", cont("返回"), { abortAction: true });
      state.queue = [];
      return;
    }
    spendAction(state, "apply", g.cost);
    state.track = track;
    state.tier = 1;
    state.bachelorAt = state.year;
    state.schoolName = fullName(state.baseName, 1, track);
    shiftRival(state, -8, "你们先升了一档。");
    if (track === "academic") {
      state.funds = clamp(state.funds + 18, 0, 220);
      addStat(state, "enrollment", 4);
      note(state, "学校升成普通本科。经费 +180万，报考 +4。");
      sync(state);
      finishAction(state, scene("升成普通本科", "省里按本科拨了一笔开办费。经费 +180万，报考 +4。后面可以申报 212。把柄没有洗掉。", cont()));
      return;
    }
    const eng = deptById(state, "eng").strength;
    const cs = deptById(state, "cs").strength;
    const focus = eng >= cs ? "eng" : "cs";
    bumpDept(state, focus, 4);
    state.funds = clamp(state.funds + 12, 0, 220);
    addStat(state, "enrollment", 6);
    note(state, "学校升成职业本科。" + deptName(focus) + " +4，经费 +120万，报考 +6。212 以后不再收。");
    sync(state);
    finishAction(state, scene(
      "升成职业本科",
      "校名换成职业技术大学。这一档到头了，212、986、D9 的材料以后不再收。后面是专业硕士点，和一次整合。" + deptName(focus) + " +4，经费 +120万，报考 +6。",
      cont()
    ));
  }

  function commitMaster(state, deptId) {
    if (state.masterPoints.indexOf(deptId) >= 0) return;
    const g = masterGates(state, deptId);
    if (!g.items.every(function (it) { return it.ok; })) {
      state.scene = gapScene(g.title + "还递不出去", g.items);
      state.queue = [];
      return;
    }
    if (state.funds < g.cost) {
      state.scene = scene("经费不够", "一个专业硕士点要 " + wan(16) + "。这次不消耗行动。", cont("返回"), { abortAction: true });
      state.queue = [];
      return;
    }
    spendAction(state, "apply", g.cost);
    state.masterPoints.push(deptId);
    bumpDept(state, deptId, 4);
    addStat(state, "reputation", 6);
    addStat(state, "enrollment", 4);
    note(state, deptName(deptId) + "拿到专业硕士点。系 +4，声誉 +6，报考 +4。以后每年经费 +30万。");
    sync(state);
    finishAction(state, scene(
      deptName(deptId) + "的专业硕士点过了",
      "这不是 212。系 +4，声誉 +6，报考 +4。以后每年多 30万。点还剩 " + (2 - state.masterPoints.length) + " 个。",
      cont()
    ));
  }

  function openCampus(state) {
    const pending = campusOf(state).pending;
    if (pending) {
      const spec = buildingById(pending);
      openQueue(state, [scene("有一座还没交付", (spec ? spec.name : "那座楼") + "明年春天才能用。今年不能再开工。", cont("返回"), { abortAction: true })]);
      return;
    }
    openQueue(state, [scene(
      "盖哪一座",
      "当季出钱开工，明年春天交付。占地要找政府批，学校自己的钱买不来亩数。",
      BUILDINGS.map(function (b) {
        let detail = wan(b.cost) + "。" + b.detail;
        if (b.academic && !(state.track === "academic" && state.tier >= 1)) detail = "普通本科之后才能建";
        else if (state.funds < b.cost) detail = "现付要 " + wan(b.cost) + "，账上不够。" + b.detail;
        return { id: "campus:" + b.id, label: b.name + "  " + buildingCount(state, b.id), detail: detail };
      }).concat([{ id: "cont", label: "返回" }]),
      { abortAction: true }
    )]);
  }

  function grantBuilding(state, id) {
    if (id === "teach") addStat(state, "teaching", 3);
    else if (id === "train") {
      bumpDept(state, "eng", 4);
      addStat(state, "teaching", 2);
    } else if (id === "lab") {
      bumpDept(state, "sci", 4);
      addStat(state, "academic", 3);
    } else if (id === "lib") addStat(state, "academic", 4);
    else if (id === "gym") addStat(state, "reputation", 3);
    else if (id === "intl") addStat(state, "international", 6);
    else if (id === "hospital") {
      bumpDept(state, "med", 8);
      addStat(state, "reputation", 3);
    } else if (id === "admin") {
      addStat(state, "compliance", 3);
      addStat(state, "heat", 4);
    }
  }

  function doCampusBuild(state, id) {
    const spec = buildingById(id);
    if (!spec) return;
    if (spec.academic && !(state.track === "academic" && state.tier >= 1)) {
      state.scene = scene("还不能建", "国际交流中心要等普通本科的牌子下来。这次不消耗行动。", cont("返回"), { abortAction: true });
      state.queue = [];
      return;
    }
    if (state.funds < spec.cost) {
      if ((state.loanYears || 0) > 0) {
        state.scene = scene("贷款还没还清", "已经有一笔在还。这笔楼要等现钱，或者等贷款结束。这次不消耗行动。", cont("返回"), { abortAction: true });
      } else {
        state.scene = scene(spec.name + "的钱不够", "现付要 " + wan(spec.cost) + "。贷款可以现在开工，今后三年每年经费 -40万。贷款没还清，申报过不了财务。", [
          { id: "campus-loan:" + spec.id, label: "贷款开工", detail: "三年每年 -40万" },
          { id: "cont", label: "先不盖" }
        ], { abortAction: true });
      }
      state.queue = [];
      return;
    }
    if (campusOf(state).pending) {
      state.scene = scene("有一座还没交付", "今年不能再开工。", cont("返回"), { abortAction: true });
      state.queue = [];
      return;
    }
    spendAction(state, "campus", spec.cost);
    campusOf(state).pending = spec.id;
    note(state, spec.name + "开工了，明年春天交付。");
    sync(state);
    finishAction(state, scene(spec.name + "开工", "钱已经出账。明年春天才能用。" + spec.detail + "。", cont()));
  }

  function doCampusLoan(state, id) {
    const spec = buildingById(id);
    if (!spec || campusOf(state).pending || (state.loanYears || 0) > 0) return;
    if (spec.academic && !(state.track === "academic" && state.tier >= 1)) return;
    spendAction(state, "campus", 0);
    state.loanYears = 3;
    state.loanPayment = 4;
    campusOf(state).pending = spec.id;
    note(state, spec.name + "用贷款开工。今后三年每年经费 -40万。");
    sync(state);
    finishAction(state, scene(spec.name + "贷款开工", "钱不在今年出。今后三年每年 -40万。还没还清的时候，申报过不了财务。明年春天交付。", cont()));
  }

  function takeDelivery(state) {
    const campus = campusOf(state);
    if (!campus.pending) return null;
    const spec = buildingById(campus.pending);
    campus.pending = null;
    if (!spec) return null;
    campus.buildings[spec.id] = (campus.buildings[spec.id] || 0) + 1;
    grantBuilding(state, spec.id);
    sync(state);
    return spec;
  }

  function mergePlacement(state) {
    const offer = state.mergeOffer || { dept: "eng", gain: 8 };
    const name = deptName(offer.dept);
    const back = Math.max(1, Math.round((offer.gain || 8) / 2));
    return scene("并进来的人怎么安置", name + "刚并进来。留人，风纪还要再掉。清退，这个系退回一半刚加上的强度。", [
      { id: "merge-keep", label: "人都留下", detail: "风纪 -6" },
      { id: "merge-cut", label: "清退一半", detail: name + " -" + back }
    ], { kind: "event" });
  }

  function shiftRival(state, n, line) {
    ensureExtras(state);
    state.rivalMomentum = clamp((state.rivalMomentum || 0) + n, 0, 100);
    if (line) note(state, line + "对面势头现在是 " + state.rivalMomentum + "。");
  }

  function wantsChair(teacher) {
    return (teacher.talent || 0) >= 72 && (teacher.greed || 0) < 55;
  }

  function maybeDelayedReport(state, teacher) {
    if (!teacher || !teacher.leverage) return "把柄跟着人走了。";
    if (Math.random() < 0.5) {
      state.delayedReport = { year: state.year + 2, name: teacher.name, dept: teacher.dept };
      return "把柄没有跟着人走，过两年可能寄回来。";
    }
    return "把柄跟着人走了。";
  }

  function poachCandidate(state) {
    const list = state.teachers.filter(function (t) {
      return t.loyalty <= 40 || ((t.talent || 0) >= 72 && !isChair(state, t));
    });
    if (!list.length) return null;
    return list.slice().sort(function (a, b) { return a.loyalty - b.loyalty || b.talent - a.talent; })[0];
  }

  function loyaltyPoach(state) {
    if (state.year - (state.lastPoach || 0) < 2) return null;
    const teacher = poachCandidate(state);
    if (!teacher) return null;
    state.lastPoach = state.year;
    const chair = wantsChair(teacher);
    const name = rivalTitle(state);
    return scene(name + "的聘书", deptName(teacher.dept) + teacher.name + (chair ? "要的不是安家费，是一个能做主的位子。" : "开了价。钱够的话，人也许留得住。") + "忠诚 " + teacher.loyalty + "。", [
      { id: "poach-pay:" + teacher.id, label: "加薪留下", detail: chair ? "他要位子。加薪留不住" : "花 " + wan(10) },
      { id: "poach-chair:" + teacher.id, label: "给学科带头人的位子", detail: chair ? "人留下，这个系稳一截" : "人留下，但心不在位子上" },
      { id: "poach-go:" + teacher.id, label: "放人走", detail: "这个系变薄。把柄可能留下" }
    ], { kind: "event" });
  }

  function resolvePoach(state, how, teacher) {
    if (!teacher) return;
    const name = rivalTitle(state);
    if (how === "pay") {
      if (wantsChair(teacher)) {
        const trail = maybeDelayedReport(state, teacher);
        removeTeacher(state, teacher, -8);
        shiftRival(state, 8, teacher.name + "还是去了" + name + "。他要的不是钱。" + trail);
        return;
      }
      if (state.funds >= 10) {
        state.funds -= 10;
        teacher.loyalty = clamp(teacher.loyalty + 16, 0, 100);
        shiftRival(state, -4, "加薪留下了" + teacher.name + "。");
      } else {
        const trail = maybeDelayedReport(state, teacher);
        removeTeacher(state, teacher, -8);
        shiftRival(state, 6, "账上不够，" + teacher.name + "走了。" + trail);
      }
      return;
    }
    if (how === "chair") {
      if (!state.chairOf) state.chairOf = {};
      state.chairOf[teacher.dept] = teacher.id;
      bumpDept(state, teacher.dept, 4);
      if (wantsChair(teacher)) {
        teacher.loyalty = clamp(teacher.loyalty + 14, 0, 100);
        shiftRival(state, -4, teacher.name + "坐上了" + deptName(teacher.dept) + "的位子，留下了。");
      } else {
        teacher.loyalty = clamp(teacher.loyalty + 4, 0, 100);
        addStat(state, "heat", 2);
        shiftRival(state, -2, teacher.name + "接下了位子，但要的是钱。把柄风险 +2。");
      }
      return;
    }
    const trail = maybeDelayedReport(state, teacher);
    removeTeacher(state, teacher, -9);
    shiftRival(state, 8, teacher.name + "去了" + name + "。" + trail);
  }

  function dormDemand(state) {
    return scene("学生来要宿舍", "在校生比宿舍和占地能装下的多。现在盖，口头答应，或者压下去。", [
      { id: "dorm-build", label: "现在盖一座宿舍", detail: wan(8) + "。钱不够就只把话说出去" },
      { id: "dorm-promise", label: "答应以后再盖", detail: "第 12 年若还挤，会翻出来" },
      { id: "dorm-hard", label: "压下去", detail: "风纪短升，创伤上去" }
    ], { kind: "event" });
  }

  function dormPromiseDue(state) {
    state.dormPromise = 0;
    if ((campusOf(state).students || 0) <= capacityOf(state)) {
      addStat(state, "reputation", 2);
      note(state, "答应过的宿舍盖上了。");
      return scene("宿舍盖上了", "当年那句话有了着落。声誉 +2。", cont("记下"), { kind: "event" });
    }
    addStat(state, "wound", 4);
    addStat(state, "enrollment", -4);
    addStat(state, "heat", 4);
    note(state, "答应过的宿舍还是不够。报考和创伤都动了。");
    return scene("那句话被翻出来了", "宿舍还是挤。报考 -4，创伤 +4，把柄风险 +4。", cont("记下"), { kind: "event" });
  }

  function jobsData(state) {
    const bad = state.lastJobs === "难找工作" || (state.enrollment || 0) < 34;
    const audit = state.policy === "jobs";
    const body = (bad ? "去年的去处不好看。照实说会伤声誉，改口径会留下风险。" : "去年的去处还能看。照实说，声誉会更好。") +
      (audit ? "省里在抽查这份表。" : "");
    return scene("就业数据被翻出来", body, [
      { id: "jobs-truth", label: "照实公布", detail: bad ? "声誉下降，风纪上升，风险下降" : "声誉上升" },
      { id: "jobs-fudge", label: "改统计口径", detail: audit ? "抽查之下，声誉掉，风险和创伤都上去" : "声誉上升，把柄风险上升" },
      { id: "jobs-spend", label: "加一笔就业扶持", detail: "花 " + wan(8) + "，报考上升" }
    ], { kind: "event" });
  }

  function rivalPressure(state) {
    ensureExtras(state);
    if ((state.rivalMomentum || 0) < 58) return null;
    if (state.year - (state.lastRivalPush || 0) < 2) return null;
    if (state.year === 4 || state.year === 8 || state.year === 12) return null;
    state.lastRivalPush = state.year;
    const name = rivalTitle(state);
    const kind = (state.rivalMomentum || 0) % 3;
    if (kind === 1) {
      addStat(state, "enrollment", -3);
      addStat(state, "reputation", -2);
      note(state, name + "先递了一档材料。报考 -3，声誉 -2。");
      return scene(name + "先递了材料", "对面先动了。报考和声誉掉了一截。", cont("知道了"), { kind: "event" });
    }
    if (kind === 2) {
      return scene(name + "出了丑闻", "对面的材料被人截了一段。你可以落井下石，也可以不掺和。", [
        { id: "rival-kick", label: "落井下石", detail: "对面势头大跌，把柄风险上去" },
        { id: "rival-still", label: "不掺和", detail: "对面势头掉一点" }
      ], { kind: "event" });
    }
    const teacher = poachCandidate(state) || state.teachers.slice().sort(function (a, b) { return b.talent - a.talent; })[0];
    if (!teacher) return null;
    return scene(name + "来抢人", "对面势头高，点名要" + deptName(teacher.dept) + teacher.name + "。", [
      { id: "poach-pay:" + teacher.id, label: "加薪留下", detail: wantsChair(teacher) ? "他要位子，加薪留不住" : "花 " + wan(10) },
      { id: "poach-chair:" + teacher.id, label: "给位子", detail: "让他做这个系的带头人" },
      { id: "poach-go:" + teacher.id, label: "放人走", detail: "这个系变薄" }
    ], { kind: "event" });
  }

  function lateReportScene(state) {
    const info = state.delayedReport;
    if (!info || state.year < info.year) return null;
    state.delayedReport = null;
    return scene(info.name + "的旧账寄回来了", deptName(info.dept) + info.name + "人已经不在。旧账还在。认下，创伤和风险上去。不认，可能变成实名举报。", [
      { id: "late-take", label: "认下", detail: "创伤 +4，把柄风险 +6" },
      { id: "late-deny", label: "不认", detail: "一半可能变成实名举报" }
    ], { kind: "event" });
  }

  const PROJECT_NAMES = {
    sci: ["一篇被外校引用的论文", "一组能写进附件的实验"],
    eng: ["一项挂了学校名字的专利", "一套能进车间的样机"],
    cs: ["一个签了名的合作课题", "一套被用起来的系统"],
    med: ["一项写进病历讨论的临床结果", "一个挂了学校名字的诊疗方案"],
    biz: ["一份企业愿意付钱的产业报告", "一个校友厂用上的方案"],
    hum: ["一项教学成果", "一份被转载的调查"]
  };

  function doProject(state, deptId) {
    ensureExtras(state);
    const dept = deptById(state, deptId);
    const lead = deptTeachers(state, deptId).slice().sort(function (a, b) { return b.talent - a.talent; })[0];
    const buildingOk = buildingCount(state, "lab") > 0 || buildingCount(state, "train") > 0 || (deptId === "med" && buildingCount(state, "hospital") > 0);
    const missing = [];
    if (!dept || dept.strength < 45) missing.push("这个系还没到 45");
    if (!buildingOk) missing.push("没有实验楼、实训楼" + (deptId === "med" ? "或附属医院" : ""));
    if (!lead) missing.push("这个系没有能牵头的人");
    if (state.funds < 12) missing.push("经费不到 " + wan(12));
    if (missing.length) {
      state.scene = scene("课题还递不出去", missing.join("；") + "。这次不消耗行动。", cont("返回"), { abortAction: true });
      state.queue = [];
      return;
    }
    spendAction(state, "project", 12);
    const chance = Math.min(80, 45 + Math.round((dept.strength - 45) / 2) + (lead.talent >= 70 ? 15 : 0));
    if (rand(100) >= chance) {
      lead.loyalty = clamp(lead.loyalty - 12, 0, 100);
      note(state, deptName(deptId) + "的课题没中。" + lead.name + "的忠诚掉了。");
      sync(state);
      finishAction(state, scene("没有批下来", wan(12) + "花了，没有成果。" + lead.name + "记着这次空跑。忠诚 -12。", cont()));
      return;
    }
    const names = PROJECT_NAMES[deptId] || PROJECT_NAMES.hum;
    const title = names[rand(names.length)];
    state.achievements.push({ year: state.year, dept: deptId, name: title });
    if (deptId === "sci" || deptId === "eng" || deptId === "cs") addStat(state, "academic", 3);
    if (deptId === "med" || deptId === "hum") addStat(state, "reputation", 3);
    if (deptId === "biz") state.funds = clamp(state.funds + 6, 0, 220);
    if (deptId === "hum") addStat(state, "enrollment", 2);
    bumpDept(state, deptId, deptId === "biz" ? 3 : 4);
    note(state, "课题过了：" + title + "。");
    sync(state);
    finishAction(state, scene(title, "挂在" + deptName(deptId) + "名下。这一笔以后可以写进结局。", cont()));
  }

function hiddenEvent(state) {
    ensureExtras(state);
    if (state.year >= 11 && (state.loanYears || 0) > 0 && !state.seenLoan) {
      state.seenLoan = true;
      return scene("审计来问这笔贷款", "楼已经在用，贷款还没还完。账可以摊开，也可以再还一截。", [
        { id: "hid-loan-open", label: "把账摊开", detail: "风纪上升，风险下降，声誉掉一点" },
        { id: "hid-loan-pay", label: "提前还一截", detail: "花 " + wan(8) + "，少还一年。钱不够就只把话说了" }
      ], { kind: "event" });
    }
    if (state.year >= 10 && (state.bribes || 0) > 0 && !(state.inspections > 0) && !state.seenLetter) {
      state.seenLetter = true;
      return scene("旧信进了附件", "收过的那笔钱没有被巡察碰过。评估组把信复印进了附件。", [
        { id: "hid-letter-write", label: "写进说明", detail: "风纪上升，声誉下降，风险下降" },
        { id: "hid-letter-hide", label: "不放进附件", detail: "风险和创伤上去，可能变成实名举报" }
      ], { kind: "event" });
    }
    if (state.year >= 10 && buildingCount(state, "hospital") > 0 && !state.seenHospital) {
      state.seenHospital = true;
      return scene("附属医院出了纠纷", "一例处置被家属拿到了校外。公开、压住，或者让医院自己出面。", [
        { id: "hid-hosp-open", label: "公开处理", detail: "风纪上升，声誉和医学掉一点" },
        { id: "hid-hosp-bury", label: "压下去", detail: "声誉暂时保住，风险和创伤上去" },
        { id: "hid-hosp-face", label: "让医院出面", detail: "花 " + wan(6) + "。医学和声誉回来" }
      ], { kind: "event" });
    }
    if (state.year >= 9 && buildingCount(state, "industry") > 0 && !state.seenFactory) {
      state.seenFactory = true;
      return scene("工厂来借校名", "产教基地对面的厂想把产品写成学校的技术。借名有钱，也有风险。", [
        { id: "hid-fact-yes", label: "答应", detail: "经费进来，风险上去，工学或经管厚一点" },
        { id: "hid-fact-no", label: "拒绝", detail: "声誉上升。厂子会去找对面。" }
      ], { kind: "event" });
    }
    return null;
  }

  function resolveHidden(state, choiceId) {
    if (choiceId === "hid-loan-open") {
      addStat(state, "compliance", 4);
      addStat(state, "heat", -4);
      addStat(state, "reputation", -2);
      note(state, "贷款的账摊开了。风纪 +4，风险 -4，声誉 -2。");
    } else if (choiceId === "hid-loan-pay") {
      if (state.funds >= 8) {
        state.funds -= 8;
        state.loanYears = Math.max(0, (state.loanYears || 0) - 1);
        note(state, "贷款提前还了 " + wan(8) + "。还剩 " + state.loanYears + " 年。");
      } else {
        addStat(state, "reputation", -2);
        note(state, "想提前还贷，账上不够。声誉 -2。");
      }
    } else if (choiceId === "hid-letter-write") {
      addStat(state, "compliance", 4);
      addStat(state, "reputation", -3);
      addStat(state, "heat", -4);
      note(state, "旧信写进了说明。风纪 +4，声誉 -3，风险 -4。");
    } else if (choiceId === "hid-letter-hide") {
      addStat(state, "heat", 8);
      state.wound = clamp(state.wound + 3, 0, 40);
      if (rand(100) < 40) {
        state.reports += 1;
        addStat(state, "reputation", -6);
        note(state, "旧信没进附件，后来还是被点了名。实名举报 +1，声誉 -6，风险 +8，创伤 +3。");
      } else {
        note(state, "旧信没进附件。风险 +8，创伤 +3。");
      }
    } else if (choiceId === "hid-hosp-open") {
      addStat(state, "compliance", 4);
      addStat(state, "reputation", -2);
      bumpDept(state, "med", -2);
      note(state, "医院的纠纷公开了。风纪 +4，声誉 -2，医学 -2。");
    } else if (choiceId === "hid-hosp-bury") {
      addStat(state, "reputation", 2);
      addStat(state, "heat", 8);
      state.wound = clamp(state.wound + 2, 0, 40);
      note(state, "医院的纠纷压下去了。声誉 +2，风险 +8，创伤 +2。");
    } else if (choiceId === "hid-hosp-face") {
      if (state.funds >= 6) {
        state.funds -= 6;
        bumpDept(state, "med", 3);
        addStat(state, "reputation", 2);
        note(state, "医院自己出面，花了 " + wan(6) + "。医学 +3，声誉 +2。");
      } else {
        addStat(state, "reputation", -2);
        note(state, "想让医院出面，钱不够。声誉 -2。");
      }
    } else if (choiceId === "hid-fact-yes") {
      state.funds = clamp(state.funds + 10, 0, 220);
      addStat(state, "heat", 6);
      addStat(state, "reputation", 1);
      const eng = deptById(state, "eng");
      const biz = deptById(state, "biz");
      const target = eng && biz && eng.strength <= biz.strength ? "eng" : "biz";
      bumpDept(state, target, 3);
      note(state, "工厂借了校名。经费进来 " + wan(10) + "，风险 +6，" + deptName(target) + " +3。");
    } else if (choiceId === "hid-fact-no") {
      addStat(state, "reputation", 3);
      state.rivalMomentum = clamp((state.rivalMomentum || 0) + 6, 0, 100);
      note(state, "校名没有借。声誉 +3。工厂去找了对面，对面势头 +6。");
    }
    sync(state);
    nextScene(state);
  }

function yearEvents(state) {
  const events = [];
  ensureExtras(state);
  if (state.mergedThisYear) events.push(mergePlacement(state));
  const late = lateReportScene(state);
  if (late) events.push(late);
  if (state.year === 1) return events.concat([scriptedBribe(state)]);
  if (state.year === 7 && (campusOf(state).students || 0) > capacityOf(state)) events.push(dormDemand(state));
  if (state.dormPromise && state.year === state.dormPromise) events.push(dormPromiseDue(state));
  if (state.year === 9) events.push(jobsData(state));
  if (state.year % 2 === 0) events.push(promotionMeeting(state));
  const story = storyBeat(state);
  const leverage = leverageTeachers(state);
  let pressure = false;
  if (leverage.length && Math.random() < 0.62) {
    events.push(leverageDemand(state, pick(leverage)));
    pressure = true;
  } else {
    const skimmer = state.teachers.find((t) => t.skimming);
    if (skimmer && Math.random() < 0.75) {
      events.push(auditEvent(state, skimmer));
      pressure = true;
    }
  }
  if (story) events.push(story);
  else if (!pressure) {
    const hidden = hiddenEvent(state);
    if (hidden) events.push(hidden);
    else {
      const poach = loyaltyPoach(state);
      const rival = rivalPressure(state);
      if (poach) events.push(poach);
      else if (rival) events.push(rival);
      else events.push(pick(ambientEvents())(state));
    }
  }
  events.push(yearEndCard(state));
  return events.filter(Boolean);
}

  function yearEndCard(state) {
    if (state.year < 4) return null;
    if ((state.heat >= 55 || state.wound >= 16) && state.year - (state.lastParty || 0) >= 2) {
      state.lastParty = state.year;
      return partyCard(state);
    }
    if (state.year === 6 || state.year === 11) return congressCard(state);
    if (state.year === 4 || state.year === 10 || state.year === 14) return chairCard(state);
    return null;
  }

  function chairCard(state) {
    const list = state.teachers.filter((t) => t.rank === 2);
    if (!list.length) return null;
    const held = list.filter((t) => t.leverage);
    const teacher = (held.length ? held : list).slice().sort((a, b) => b.talent - a.talent)[0];
    const meta = deptName(teacher.dept);
    const bite = teacher.leverage
      ? "他手里有把柄。人上去，把柄留在这个位置上。"
      : "他没有把柄。系会稳一截。";
    return scene(meta + "缺学科带头人", meta + teacher.name + "是副教授。" + bite, [
      { id: "chair:yes:" + teacher.id, label: "让他来坐", detail: teacher.leverage ? "系稳一截，把柄留在带头人身上" : "这个系稳一截" },
      { id: "chair:no:" + teacher.id, label: "先空着", detail: "这个系薄一截" }
    ], { kind: "event" });
  }

  function congressCard(state) {
    const topics = [
      { key: "canteen", name: "食堂", hit: "风纪" },
      { key: "dorm", name: "宿舍", hit: "风纪" },
      { key: "status", name: "学籍", hit: "报考" }
    ];
    const topic = topics[rand(topics.length)];
    return scene("教代会的提案", "提案写的是" + topic.name + "。答应要花 " + wan(6) + "，声誉能回来一点。压下去，" + topic.hit + "会掉。", [
      { id: "congress:yes:" + topic.key, label: "答应", detail: "账上够就出 " + wan(6) + "，声誉回来一点" },
      { id: "congress:no:" + topic.key, label: "压下去", detail: topic.hit + "往下" }
    ], { kind: "event" });
  }

  function partyCard(state) {
    return scene("党委要听汇报", "把柄和举报还在。这份汇报本身就是压力。说轻了，巡视组会来得更快。", [
      { id: "party:plain", label: "如实说", detail: "风纪回来一点，风险仍要上去" },
      { id: "party:soft", label: "说轻一点", detail: "风险抬得更高，风纪下去" }
    ], { kind: "event" });
  }

  function resolveChair(state, how, teacherId) {
    const teacher = teacherById(state, teacherId);
    if (!teacher) return;
    const meta = DEPTS.find((d) => d.id === teacher.dept);
    if (how === "yes") {
      if (!state.chairOf) state.chairOf = {};
      state.chairOf[teacher.dept] = teacher.id;
      bumpDept(state, teacher.dept, 4);
      if (teacher.leverage) addStat(state, "heat", 4);
      note(state, teacher.name + "坐上" + meta.name + "的学科带头人。" + (teacher.leverage ? "把柄还在。" : ""));
      feedback(state, "位置有人了", meta.name + "稳了 4。" + (teacher.leverage ? "把柄在他手里。" : teacher.name + "现在是学科带头人。"));
      return;
    }
    bumpDept(state, teacher.dept, -3);
    note(state, meta.name + "的学科带头人先空着。");
    feedback(state, "位置还空着", meta.name + "薄了 3。");
  }

  function resolveCongress(state, how, key) {
    const name = key === "dorm" ? "宿舍" : key === "status" ? "学籍" : "食堂";
    if (how === "yes") {
      const paid = state.funds >= 6;
      if (paid) state.funds -= 6;
      else addStat(state, "reputation", -2);
      addStat(state, "reputation", 3);
      note(state, "教代会的" + name + "提案答应了。" + (paid ? "经费 -60万。" : "账上不够，钱没出去。"));
      feedback(state, "提案答应了", "声誉回来一点。账上够，钱才出得去。");
      return;
    }
    if (key === "status") {
      addStat(state, "enrollment", -4);
      note(state, "学籍提案被压下。报考掉了一截。");
      feedback(state, "提案压下了", "学籍没动。报考热度掉了一截。");
      return;
    }
    addStat(state, "compliance", -4);
    note(state, name + "提案被压下。风纪掉了一截。");
    feedback(state, "提案压下了", name + "还是老样子。风纪掉了一截。");
  }

  function resolveParty(state, how) {
    if (how === "plain") {
      addStat(state, "compliance", 4);
      addStat(state, "heat", 3);
      note(state, "汇报如实说了。风险仍在往上走。");
      feedback(state, "汇报送上去了", "风纪回来一点。把柄还在，巡视组看的就是这些数。");
      return;
    }
    addStat(state, "heat", 8);
    addStat(state, "compliance", -3);
    note(state, "汇报说轻了。风险抬得更高。");
    feedback(state, "汇报说轻了", "会上把事情说轻了。风险抬上去，风纪下去，巡视组来得更快。");
  }

  function rivalTitle(state) {
    if (state.tier >= 2) return "滨江大学";
    if (state.tier >= 1) return "滨江学院";
    return "滨江职业技术学院";
  }

  function storyBeat(state) {
    const s = state.story;
    if (!s) return null;
    if (s.profBeat === 0 && state.year >= 3 && state.year % 2 === 1) {
      s.profBeat = 1;
      return profChapterTwo(state);
    }
    if (s.rivalBeat === 0 && state.year >= 4) {
      s.rivalBeat = 1;
      return rivalChapterOne(state);
    }
    if (s.incidentBeat === 0 && state.year >= 5) {
      s.incidentBeat = 1;
      return incidentChapter(state);
    }
    if (s.incidentBeat === 1 && s.incidentChoice && state.year >= 7) {
      s.incidentBeat = 2;
      return incidentEcho(state);
    }
    if (s.rivalBeat === 1 && state.year >= 8) {
      s.rivalBeat = 2;
      return rivalChapterTwo(state);
    }
    if (s.profBeat === 1 && state.year >= 9) {
      s.profBeat = 2;
      return profChapterThree(state);
    }
    if (s.rivalBeat === 2 && state.year >= 12) {
      s.rivalBeat = 3;
      return rivalChapterThree(state);
    }
    return null;
  }

  function profChapterTwo(state) {
    const s = state.story;
    const teacher = teacherById(state, s.profId);
    const name = s.profName || (teacher && teacher.name) || "那位教师";
    if (!teacher || s.profAct === "left") {
      note(state, name + "人不在了，工学系的位子还空着。");
      return scene(name + "的位子空着", "他已经不在学校。有人说课在滨江那边开。工学系的方向薄了一截，没有新的信封。", cont("记下"), { kind: "event" });
    }
    if (s.profAct === "reported") {
      s.enrollMod -= 2;
      note(state, name + "的旧信被复印进了评估附件。");
      return scene("旧信又被翻出来", name + "没有再写信。档案室把去年那封复印进了评估附件。不是新的举报，报考的人会看见这一页。", cont("记下"), { kind: "event" });
    }
    if (s.profAct === "taken" || s.profAct === "helped" || s.profAct === "quiet") {
      return scene(name + "没进办公室", "他握着你收过的那件事，今年没有把信封放上来。推荐语里写了这笔，没有写你的名字。", [
        { id: "story:prof-silence", label: "让这句话停在系里", detail: "风险再高一点，事情不公开" },
        { id: "story:prof-rewrite", label: "要求他改掉推荐语", detail: "他会不高兴，把柄还在" }
      ], { kind: "event" });
    }
    if (s.profAct === "merit") {
      return scene(name + "送来一个课题", "他去年按标准升了。今年课题书是干的，没有信封。他问联合署名写工学，还是拿去补学校的短板。", [
        { id: "story:prof-eng", label: "留在工学", detail: "这个系和学术一起动一点" },
        { id: "story:prof-med", label: "转去补医学", detail: "短板动一截，他不太情愿" }
      ], { kind: "event" });
    }
    return scene(name + "今年没带信封", "论文比去年厚。致谢里有你的名字，语气很平。他没有再提那笔钱。", [
      { id: "story:prof-admit", label: "公开说去年退得对", detail: "声誉和这个人都会稳一点" },
      { id: "story:prof-quiet", label: "只按程序，不提去年", detail: "事情过去，他记着" }
    ], { kind: "event" });
  }

  function profChapterThree(state) {
    const s = state.story;
    const teacher = teacherById(state, s.profId);
    const name = s.profName || "那位教师";
    const rival = rivalTitle(state);
    if (!teacher || s.profAct === "left") {
      addStat(state, "reputation", -2);
      note(state, name + "在" + rival + "带他的方向。");
      return scene(name + "在对面开课", "他现在是" + rival + "的方向负责人。区域榜的说明里用的是他带走的那个题目。", cont("看过了"), { kind: "event" });
    }
    if (s.profAct === "reported") {
      return scene("外审意见里有他的名字", "不是新的一封信。申报材料的背景页把旧举报印了出来。评审问学校打算怎么写说明。", [
        { id: "story:prof-explain", label: "在说明里写清楚", detail: "风纪回一点，声誉还是会掉" },
        { id: "story:prof-ignore", label: "当没看见", detail: "报考热度往下，风险往上" }
      ], { kind: "event" });
    }
    if (s.profAct === "merit") {
      return scene(name + "要一个联合中心", "他的团队够格写进附件。他要理学和工学的联合中心挂他的名。材料是干的。", [
        { id: "story:prof-name", label: "挂他的名", detail: "工学和学术都会动" },
        { id: "story:prof-noname", label: "中心归学校", detail: "成果留下，他不高兴" }
      ], { kind: "event" });
    }
    if (s.profAct === "refused") {
      return scene(rival + "来挖" + name, "他能独立带学生了。对面开了价。他问你，学校还认不认当年那次退回。", [
        { id: "story:prof-stay", label: "加薪留下", detail: "花经费，工学不散" },
        { id: "story:prof-go", label: "放他去" + rival, detail: "这个方向会薄" }
      ], { kind: "event" });
    }
    return scene(name + "要改校庆致谢", teacher.leverage
      ? "校庆名册上，他要你把致谢写成共同主持。话没有说破。你收过的那件事，他还握着。"
      : "那件事后来被按住了，人还在。校庆致谢上，他仍要写成共同主持。", [
      { id: "story:prof-credit", label: "写成共同主持", detail: "工学抬一截，声誉和风纪往下" },
      { id: "story:prof-school", label: "致谢只写学校", detail: "他记着。已经在他手里的把柄不会因此消失" }
    ], { kind: "event" });
  }

  function rivalChapterOne(state) {
    const name = rivalTitle(state);
    if (state.tier === 0 && state.score < 38) {
      note(state, name + "的交流名单上没有你们。");
      return scene(name + "没有回函", "对面忙自己的升本。你们的名字不在交流名单上。这一年他们不挖人，也不递材料。", cont("知道了"), { kind: "event" });
    }
    const ranked = state.teachers.slice().sort((a, b) => b.talent - a.talent);
    if (!ranked.length) return scene(name + "来过", "对面想挖人，校园里已经没有能被点名的带头人。", cont("知道了"), { kind: "event" });
    const teacher = ranked[0];
    return scene(name + "点名要人", deptName(teacher.dept) + teacher.name + "收到了对面的聘书。价比你们的安家费高。他们是冲着你们这几年的势头来的。", [
      { id: "keep:" + teacher.id, label: "加薪留下", detail: "花经费，系不散" },
      { id: "letgo:" + teacher.id, label: "放人去" + name, detail: "这个系立刻变薄" }
    ], { kind: "event" });
  }

  function rivalChapterTwo(state) {
    const name = rivalTitle(state);
    if (state.tier === 0 && state.score < 42) {
      note(state, name + "没有把你们放进对手名单。");
      return scene(name + "没把你们当对手", "对面忙着自己的升格。区域榜的说明里没有你们学校。", cont("知道了"), { kind: "event" });
    }
    return scene("区域榜上，" + name + "在你们前面", "他们的材料写得很满。你们最短的那个系被点了名。", [
      { id: "story:rival-quiet", label: "不做声", detail: "声誉掉一截" },
      { id: "story:rival-spin", label: "改对外口径", detail: "花钱，声誉和报考能回来一点" }
    ], { kind: "event" });
  }

  function rivalChapterThree(state) {
    const name = rivalTitle(state);
    if (state.tier === 0) {
      state.story.enrollMod -= 3;
      note(state, name + "的招生简章印在你们旁边。");
      return scene(name + "的简章字号更大", "他们已经是学院。招生处把两份简章放在一起，对面那份更厚。", cont("记下"), { kind: "event" });
    }
    const sameBatch = state.tier === 1;
    return scene(sameBatch ? name + "和你们递进同一批" : name + "的申辩寄到了学校", sameBatch
      ? "评审会上有人问，两所学校的工学是不是在抢同一批导师。"
      : "他们这一档没过。申辩材料里点了你们的工学，意见寄到了学校。", [
      { id: "story:rival-fair", label: "正常答辩", detail: "理学够的话，学术和声誉会动" },
      { id: "story:rival-jab", label: "在会上点他们的短处", detail: "风纪往下，风险往上" }
    ], { kind: "event" });
  }

  function incidentChapter(state) {
    const dept = state.depts.slice().sort((a, b) => a.strength - b.strength)[0];
    state.story.incidentDept = dept.id;
    const meta = deptName(dept.id);
    let absent = "";
    if (!state.facedStudents) {
      addStat(state, "heat", 4);
      state.story.enrollMod -= 2;
      note(state, "校长今年没在学生面前出现。舆论更重。");
      absent = "校长今年没在学生面前说过话，这件事传得更远。";
    }
    if (state.story.incidentKind === "post") {
      return scene("一篇实名帖", "帖子点了" + meta + "的一门课，在校外传了一天。本地媒体问学校有没有回应。" + absent, [
        { id: "story:post-bury", label: "先把热度压下去", detail: "风险上升，报考会慢一截" },
        { id: "story:post-open", label: "公开查这门课", detail: "风纪上升，这个系要挨一下" },
        { id: "story:post-face", label: "让任课教师出面", detail: "看这个系的人怎么说话" }
      ], { kind: "event" });
    }
    if (state.story.incidentKind === "accident") {
      return scene("校庆台阶塌了一角", meta + "楼前的临时台阶塌了。没有重伤。视频先于通报出去。" + absent, [
        { id: "story:accident-cold", label: "冷处理", detail: "声誉和报考一起往下" },
        { id: "story:accident-pay", label: "赔偿并公开", detail: "花钱，声誉能回来" },
        { id: "story:accident-blame", label: "追到这个系", detail: "系会薄，风纪回升" }
      ], { kind: "event" });
    }
    return scene(meta + "停了两周课", "学生把理由写在教学楼上：课表排得下，带教的人不够。最短的就是这个系。" + absent, [
      { id: "story:strike-talk", label: "谈话后复课", detail: "声誉轻伤，报考会慢" },
      { id: "story:strike-punish", label: "处分组织的学生", detail: "风纪上升，舆论和报考更差" },
      { id: "story:strike-dept", label: "把问题记到这个系头上", detail: "系往下掉，风纪和声誉回一点" }
    ], { kind: "event" });
  }

  function incidentEcho(state) {
    const s = state.story;
    const meta = deptName(s.incidentDept);
    const c = s.incidentChoice;
    if (c === "talk") {
      s.enrollMod -= 2;
      note(state, "报考指南的脚注里还印着那场停课。");
      return scene("停课还在脚注里", meta + "复课之后，第二年的报考指南仍印着那两周。", cont("记下"), { kind: "event" });
    }
    if (c === "punish") {
      addStat(state, "reputation", -3);
      s.enrollMod -= 2;
      note(state, "处分决定被贴到了区域论坛。");
      return scene("处分决定被贴了出来", "被处分的学生把决定书贴出去了。风纪那一栏还在，报考的人在看这张图。", cont("记下"), { kind: "event" });
    }
    if (c === "dept") {
      bumpDept(state, s.incidentDept, 2);
      s.enrollMod -= 1;
      note(state, meta + "的课表改了，报考仍然偏少。");
      return scene("课表改了，人还没回来", "实验课补上了一部分。" + meta + "比停课那年稳一点，招生页上仍写着编制不足。", cont("记下"), { kind: "event" });
    }
    if (c === "bury") {
      addStat(state, "reputation", -4);
      addStat(state, "heat", 4);
      note(state, "删帖的事今年又被翻出来。");
      return scene("删掉的帖子又回来了", "有人留了备份。今年的口径比去年更难圆。", cont("记下"), { kind: "event" });
    }
    if (c === "open") {
      addStat(state, "compliance", 2);
      s.enrollMod += 1;
      note(state, "调查结论写进了质量报告。");
      return scene("调查写进了质量报告", meta + "那门课的结论是公开的。风波过去了，报考比去年稳。", cont("记下"), { kind: "event" });
    }
    if (c === "face") {
      if (s.incidentFaceOk) {
        addStat(state, "reputation", 2);
        note(state, "教师的回应被收进了招生页。");
        return scene("回应还挂在招生页上", "去年出面的那段话被收进了简章。没有新的帖子。", cont("记下"), { kind: "event" });
      }
      addStat(state, "heat", 3);
      note(state, "教师的回应被截成了更糟的一段。");
      return scene("回应被截短了", "去年那段话只剩下最冲的一句。热度比沉默更高。", cont("记下"), { kind: "event" });
    }
    if (c === "cold") {
      addStat(state, "reputation", -2);
      s.enrollMod -= 3;
      note(state, "旧视频还在，招生被问到台阶。");
      return scene("旧视频还在", "校庆台阶的视频没有删干净。招生老师被问到的还是那一角。", cont("记下"), { kind: "event" });
    }
    if (c === "pay") {
      addStat(state, "reputation", 1);
      note(state, "赔偿名单平息了大部分问题。");
      return scene("赔偿名单还在", "名字和金额是公开的。今年没有新的视频。", cont("记下"), { kind: "event" });
    }
    if (c === "blame") {
      bumpDept(state, s.incidentDept, 2);
      s.enrollMod += 1;
      note(state, meta + "换了负责的人，台阶也换了。");
      return scene("台阶换过了", "负责人已经不是去年那位。" + meta + "楼前的台阶是新的。", cont("记下"), { kind: "event" });
    }
    return scene("去年的事没有后续", "公开事件没有留下新的一页。", cont("继续"), { kind: "event" });
  }

  function resolveStory(state, id) {
    const s = state.story;
    const teacher = s && teacherById(state, s.profId);
    const name = (s && s.profName) || (teacher && teacher.name) || "他";
    if (id === "prof-silence") {
      addStat(state, "heat", 2);
      note(state, name + "的推荐语留在系里。");
    } else if (id === "prof-rewrite") {
      addStat(state, "heat", 4);
      addStat(state, "reputation", 1);
      if (teacher) teacher.loyalty = clamp(teacher.loyalty - 10, 0, 100);
      note(state, "你让" + name + "改掉了推荐语。把柄还在。");
    } else if (id === "prof-eng") {
      bumpDept(state, "eng", 3);
      addStat(state, "academic", 1);
      note(state, name + "的课题留在工学。");
    } else if (id === "prof-med") {
      bumpDept(state, "med", 4);
      if (teacher) teacher.loyalty = clamp(teacher.loyalty - 6, 0, 100);
      note(state, name + "的课题被拿去补医学。");
    } else if (id === "prof-admit") {
      addStat(state, "reputation", 2);
      addStat(state, "academic", 1);
      if (teacher) teacher.loyalty = clamp(teacher.loyalty + 8, 0, 100);
      note(state, "你公开说去年退回" + name + "是对的。");
    } else if (id === "prof-quiet") {
      if (teacher) teacher.loyalty = clamp(teacher.loyalty + 2, 0, 100);
      note(state, name + "的材料按程序过了一遍，没人提去年。");
    } else if (id === "prof-explain") {
      addStat(state, "compliance", 3);
      addStat(state, "reputation", -2);
      note(state, "旧举报写进了说明。");
    } else if (id === "prof-ignore") {
      addStat(state, "heat", 3);
      s.enrollMod -= 3;
      note(state, "外审那一页被放过了。报考热度会受影响。");
    } else if (id === "prof-name") {
      bumpDept(state, "eng", 4);
      addStat(state, "academic", 2);
      addStat(state, "reputation", 1);
      note(state, "联合中心挂上了" + name + "的名字。");
    } else if (id === "prof-noname") {
      addStat(state, "academic", 1);
      if (teacher) teacher.loyalty = clamp(teacher.loyalty - 8, 0, 100);
      note(state, "联合中心没有挂个人的名字。");
    } else if (id === "prof-stay") {
      if (state.funds >= 8) state.funds -= 8;
      else addStat(state, "reputation", -2);
      bumpDept(state, "eng", 3);
      if (teacher) teacher.loyalty = clamp(teacher.loyalty + 12, 0, 100);
      note(state, "加薪留下了" + name + "。");
    } else if (id === "prof-go") {
      if (teacher) removeTeacher(state, teacher, -6);
      addStat(state, "reputation", -2);
      note(state, name + "去了" + rivalTitle(state) + "。");
    } else if (id === "prof-credit") {
      bumpDept(state, "eng", 3);
      addStat(state, "reputation", -2);
      addStat(state, "heat", 4);
      addStat(state, "compliance", -3);
      note(state, "校庆致谢写成了和" + name + "共同主持。");
    } else if (id === "prof-school") {
      addStat(state, "heat", 4);
      if (teacher) teacher.loyalty = clamp(teacher.loyalty - 12, 0, 100);
      note(state, "致谢只写了学校。" + name + "记着这件事。");
    } else if (id === "strike-talk") {
      s.incidentChoice = "talk";
      addStat(state, "reputation", -2);
      addStat(state, "compliance", 2);
      s.enrollMod -= 3;
      note(state, "谈话之后复了课。报考会慢一截。");
    } else if (id === "strike-punish") {
      s.incidentChoice = "punish";
      addStat(state, "compliance", 6);
      addStat(state, "reputation", -4);
      s.enrollMod -= 4;
      note(state, "组织停课的学生被处分了。");
    } else if (id === "strike-dept") {
      s.incidentChoice = "dept";
      bumpDept(state, s.incidentDept, -6);
      addStat(state, "compliance", 4);
      addStat(state, "reputation", 1);
      note(state, deptName(s.incidentDept) + "被记上了停课的责任。");
    } else if (id === "post-bury") {
      s.incidentChoice = "bury";
      addStat(state, "heat", 6);
      addStat(state, "reputation", 1);
      s.enrollMod -= 2;
      note(state, "实名帖先被压了下去。");
    } else if (id === "post-open") {
      s.incidentChoice = "open";
      addStat(state, "compliance", 5);
      addStat(state, "reputation", -2);
      bumpDept(state, s.incidentDept, -3);
      note(state, "那门课被公开查了。");
    } else if (id === "post-face") {
      s.incidentChoice = "face";
      const greedy = deptTeachers(state, s.incidentDept).some((t) => t.greed >= 70);
      s.incidentFaceOk = !greedy;
      if (greedy) {
        addStat(state, "heat", 3);
        addStat(state, "reputation", -1);
        note(state, "任课教师的回应把事情说得更糟。");
      } else {
        addStat(state, "reputation", 3);
        note(state, "任课教师的回应把帖子按住了。");
      }
    } else if (id === "accident-cold") {
      s.incidentChoice = "cold";
      addStat(state, "reputation", -5);
      s.enrollMod -= 4;
      note(state, "校庆事故被冷处理了。");
    } else if (id === "accident-pay") {
      s.incidentChoice = "pay";
      state.funds = clamp(state.funds - 10, 0, 220);
      addStat(state, "reputation", 2);
      s.enrollMod += 1;
      note(state, "校庆事故赔了，通报也发了。");
    } else if (id === "accident-blame") {
      s.incidentChoice = "blame";
      bumpDept(state, s.incidentDept, -5);
      addStat(state, "compliance", 5);
      addStat(state, "reputation", 1);
      note(state, deptName(s.incidentDept) + "的负责人被追了责。");
    } else if (id === "rival-quiet") {
      addStat(state, "reputation", -2);
      note(state, rivalTitle(state) + "在区域榜上压过你们，学校没有回应。");
    } else if (id === "rival-spin") {
      if (state.funds >= 6) state.funds -= 6;
      else addStat(state, "reputation", -1);
      addStat(state, "reputation", 2);
      s.enrollMod += 1;
      note(state, "对外口径改过了。");
    } else if (id === "rival-fair") {
      const sci = deptById(state, "sci").strength;
      if (sci >= 50) {
        addStat(state, "academic", 2);
        addStat(state, "reputation", 2);
        note(state, "答辩按材料走完，理学撑住了。");
      } else {
        addStat(state, "reputation", -2);
        note(state, "答辩按材料走完，理学没有撑住提问。");
      }
    } else if (id === "rival-jab") {
      addStat(state, "compliance", -4);
      addStat(state, "reputation", 1);
      addStat(state, "heat", 3);
      shiftRival(state, -6, "会上点了" + rivalTitle(state) + "的短处。");
    }
  }

  function scriptedBribe(state) {
    const teacher = deptTeachers(state, "eng").slice().sort((a, b) => a.rank - b.rank)[0] || state.teachers[0];
    teacher.greed = Math.max(teacher.greed, 75);
    if (state.story) {
      state.story.profId = teacher.id;
      state.story.profName = teacher.name;
    }
    return scene(
      "第一份递到你桌上的材料",
      "工学系" + teacher.name + "差两篇像样的成果。他把一笔可以进学校账户的好处压在表格下面，说评审那天办公室里不会有第二个人。",
      [
        { id: "clean:" + teacher.id, label: "按标准退回", detail: talentLine(teacher) },
        { id: "take:" + teacher.id, label: "收下，特批", detail: "学校账上会多一笔，把柄在他手里" }
      ],
      { kind: "event" }
    );
  }

  function leverageDemand(state, teacher) {
    const meta = DEPTS.find((d) => d.id === teacher.dept);
    const asks = [
      {
        id: "list",
        line: "他要你在下一个名单里直接写他的名字。",
        detail: "职级升一档，系变强，学术下降，风险上升"
      },
      {
        id: "audit",
        line: "他实验室的账对不上，要你让审计这学期别进这个系。",
        detail: "审计不进这个系。风纪下降，把柄还在。他不升职"
      },
      {
        id: "quota",
        line: "他要一个不受名额限制的留校名额，给自己的学生。",
        detail: "学生留下，这个系稳一点。经费下去，他不升职"
      }
    ];
    const ask = pick(asks);
    return scene(
      teacher.name + "来兑现",
      meta.name + "的" + teacher.name + "握着你收钱的那件事。" + ask.line,
      [
        { id: "help:" + teacher.id + ":" + ask.id, label: "帮", detail: ask.detail },
        { id: "refuse:" + teacher.id, label: "不帮", detail: "可能离职，也可能举报。举报伤综合评分" }
      ],
      { kind: "event" }
    );
  }

  function auditEvent(state, teacher) {
    teacher.skimming = false;
    const meta = DEPTS.find((d) => d.id === teacher.dept);
    return scene(
      "审计标出一笔差价",
      meta.name + teacher.name + "的课题账上有一个洞。他不解释用途，只问你要不要把这笔差价改记到学校发展基金里。",
      [
        { id: "audit:" + teacher.id, label: "移交审计", detail: "人会走，风纪回升，这个系短痛" },
        { id: "refund:" + teacher.id, label: "勒令退回学校", detail: "经费收回一部分，他知道你掌握了这件事" },
        { id: "skim:" + teacher.id, label: "改记账目，学校留下这笔", detail: "经费变多，把柄留下" }
      ],
      { kind: "event" }
    );
  }

function ambientEvents() {
  return [mediaEvent, giftEvent, contestEvent];
}

function mediaEvent(state) {
  const band = worldBand(rankScore(state));
  return scene("今年的榜", "寰球榜把学校放在「" + band.label + "」。区域榜是「" + regionBand(rankScore(state)) + "」。按这个名次对外，或者花钱改口径。", [
    { id: "rank-take", label: "按这个名次对外", detail: "风纪稳住，报考热度掉一截" },
    { id: "rank-spin", label: "改对外口径", detail: "花钱，声誉回来一点，风纪往下" }
  ], { kind: "event" });
}

function giftEvent(state) {
  const weak = state.depts.slice().sort((a, b) => a.strength - b.strength)[0];
  const meta = DEPTS.find((d) => d.id === weak.id);
  return scene("一笔不带名字的省里拨款", "文件写的是学科建设。钱落到哪一栏，另一栏就要让。", [
    { id: "grant-sci", label: "投给理学", detail: "理学和学术上去，医学薄一截" },
    { id: "grant-weak:" + weak.id, label: "补给" + meta.name, detail: "最短的系上去，经费扣一截" },
    { id: "grant-fund", label: "先存进经费", detail: "账上变多，声誉往下" }
  ], { kind: "event" });
}

function poachEvent(state) {
  const stars = state.teachers.filter((t) => t.talent >= 70 && !t.leverage);
  if (!stars.length) return mediaEvent(state);
  const teacher = pick(stars);
  const meta = DEPTS.find((d) => d.id === teacher.dept);
  return scene("别的学校来挖人", meta.name + teacher.name + "收到了一份待遇更好的聘书。", [
    { id: "keep:" + teacher.id, label: "加薪留下", detail: "花经费，系不散" },
    { id: "letgo:" + teacher.id, label: "放人走", detail: "这个系立刻变薄" }
  ], { kind: "event" });
}

function contestEvent() {
  return scene("学生把奖杯带回来了", "一次干净的胜仗。写进附件时，要决定记在哪一栏。", [
    { id: "contest-rep", label: "拿去抬声誉", detail: "声誉上去，学术让一截" },
    { id: "contest-depts", label: "记到理学和工学", detail: "这两个系上去，教学让一截" }
  ], { kind: "event" });
}

  function choose(state, choiceId) {
    if (!state.scene) return;
    if (choiceId === "cont") {
      if (state.scene && state.scene.abortAction) {
        state.scene = null;
        state.queue = [];
        state.phase = "play";
        return;
      }
      nextScene(state);
      return;
    }
    if (choiceId === "bulletin") {
      afterBulletin(state);
      return;
    }
    if (choiceId === "office:tilt") {
      state.scene = officePick(state);
      return;
    }
    if (choiceId === "office:back") {
      state.scene = null;
      state.queue = [];
      openOffice(state);
      return;
    }
    if (choiceId === "office:punish") return doOfficePunish(state);
    if (choiceId === "office:file") return doOfficeFile(state);
    if (choiceId.indexOf("office-dept:") === 0) return doOfficeTilt(state, choiceId.slice("office-dept:".length));
    if (choiceId === "gov:build") {
      state.scene = govPick(state);
      return;
    }
    if (choiceId === "gov:back") {
      state.scene = null;
      state.queue = [];
      openGov(state);
      return;
    }
    if (choiceId === "gov:money") return doGovMoney(state);
    if (choiceId === "gov:land") return doGovLand(state);
    if (choiceId === "gov:merge") {
      if (state.funds < 20) {
        state.scene = scene("账上不够", "整合要先垫得出 " + wan(20) + "。这次不消耗行动。", cont("返回"), { abortAction: true });
        state.queue = [];
        return;
      }
      state.scene = scene("整合哪一所", "举办者点头。人、债和地一起进来。", [
        { id: "merge:med", label: "卫校", detail: "医学 +10，占地 +80。经费 -160万，风纪 -8，并入 4 人" },
        { id: "merge:eng", label: "机电校", detail: "工学 +8，占地 +160，宿舍 +1。风险 +8，文法 -4。下一年不能申报" },
        { id: "merge:biz", label: "财经校", detail: "经管 +8，报考 +6，占地 +100。创伤 +4，最短的系 -4" },
        { id: "cont", label: "返回" }
      ], { abortAction: true });
      return;
    }
    if (choiceId.indexOf("merge:") === 0) return doMerge(state, choiceId.slice("merge:".length));
    if (choiceId === "merge-keep") {
      addStat(state, "compliance", -6);
      state.mergedThisYear = false;
      note(state, "并进来的人都留下了。风纪掉了 6。");
      sync(state);
      nextScene(state);
      return;
    }
    if (choiceId === "merge-cut") {
      const offer = state.mergeOffer || { dept: "eng", gain: 8 };
      const back = Math.max(1, Math.round((offer.gain || 8) / 2));
      bumpDept(state, offer.dept, -back);
      state.mergedThisYear = false;
      note(state, "清退了一半。" + deptName(offer.dept) + " -" + back + "。");
      sync(state);
      nextScene(state);
      return;
    }
    if (choiceId.indexOf("apply-track:") === 0) return commitBachelor(state, choiceId.slice("apply-track:".length));
    if (choiceId.indexOf("master-dept:") === 0) return commitMaster(state, choiceId.slice("master-dept:".length));
    if (choiceId.indexOf("strategy:") === 0) return chooseStrategy(state, choiceId.slice("strategy:".length));
    if (choiceId === "policy-ack") return ackPolicy(state);
    if (choiceId.indexOf("succeed:") === 0) return chooseSuccession(state, choiceId.slice("succeed:".length));
    if (choiceId.indexOf("hid-") === 0) return resolveHidden(state, choiceId);
    if (choiceId.indexOf("campus-loan:") === 0) return doCampusLoan(state, choiceId.slice("campus-loan:".length));
    if (choiceId.indexOf("campus:") === 0) return doCampusBuild(state, choiceId.slice("campus:".length));
    if (choiceId.indexOf("poach-") === 0) {
      const bits = choiceId.split(":");
      resolvePoach(state, bits[0].slice("poach-".length), teacherById(state, bits[1]));
      sync(state);
      nextScene(state);
      return;
    }
    if (choiceId === "dorm-build") {
      if (state.funds >= 8) {
        state.funds -= 8;
        campusOf(state).buildings.dorm = (campusOf(state).buildings.dorm || 0) + 1;
        note(state, "学生要宿舍，今年盖了一座。");
      } else {
        addStat(state, "reputation", -3);
        state.dormPromise = 12;
        note(state, "宿舍的钱不够，话先说了出去。第 12 年会再看。");
      }
      sync(state);
      nextScene(state);
      return;
    }
    if (choiceId === "dorm-promise") {
      state.dormPromise = 12;
      note(state, "答应第 12 年再看宿舍。");
      sync(state);
      nextScene(state);
      return;
    }
    if (choiceId === "dorm-hard") {
      addStat(state, "compliance", 4);
      addStat(state, "wound", 4);
      note(state, "宿舍的诉求被压下去了。风纪 +4，创伤 +4。");
      sync(state);
      nextScene(state);
      return;
    }
    if (choiceId === "jobs-truth") {
      const bad = state.lastJobs === "难找工作" || (state.enrollment || 0) < 34;
      if (bad) {
        addStat(state, "reputation", -4);
        addStat(state, "compliance", 4);
        addStat(state, "heat", -4);
        note(state, "就业数据照实公布。声誉 -4，风纪 +4，风险 -4。");
      } else {
        addStat(state, "reputation", 3);
        note(state, "就业数据照实公布。声誉 +3。");
      }
      sync(state);
      nextScene(state);
      return;
    }
    if (choiceId === "jobs-fudge") {
      if (state.policy === "jobs") {
        addStat(state, "reputation", -2);
        addStat(state, "heat", 14);
        state.wound = clamp(state.wound + 4, 0, 40);
        note(state, "就业口径改过了，抽查对上了。声誉 -2，把柄风险 +14，创伤 +4。");
      } else {
        addStat(state, "reputation", 4);
        addStat(state, "heat", 8);
        note(state, "就业口径改过了。声誉 +4，把柄风险 +8。");
      }
      sync(state);
      nextScene(state);
      return;
    }
    if (choiceId === "jobs-spend") {
      if (state.funds >= 8) {
        state.funds -= 8;
        addStat(state, "enrollment", 4);
        state.pushedJobs = true;
        note(state, "就业扶持拨了 " + wan(8) + "。报考 +4。");
      } else {
        addStat(state, "reputation", -2);
        note(state, "就业扶持没有钱。声誉 -2。");
      }
      sync(state);
      nextScene(state);
      return;
    }
    if (choiceId === "rival-kick") {
      addStat(state, "heat", 6);
      addStat(state, "reputation", -2);
      shiftRival(state, -12, "你拿对面的丑闻做了文章。");
      sync(state);
      nextScene(state);
      return;
    }
    if (choiceId === "rival-still") {
      shiftRival(state, -4, "对面的丑闻自己凉了下去。");
      sync(state);
      nextScene(state);
      return;
    }
    if (choiceId === "late-take") {
      addStat(state, "wound", 4);
      addStat(state, "heat", 6);
      note(state, "旧账认下了。创伤 +4，把柄风险 +6。");
      sync(state);
      nextScene(state);
      return;
    }
    if (choiceId === "late-deny") {
      if (Math.random() < 0.5) {
        state.reports += 1;
        state.wound = clamp(state.wound + 6, 0, 40);
        addStat(state, "reputation", -8);
        addStat(state, "heat", 10);
        note(state, "旧账被写成了实名举报。");
      } else {
        addStat(state, "heat", 4);
        note(state, "旧账没有写成举报，风险还是上去了。");
      }
      sync(state);
      nextScene(state);
      return;
    }
    if (choiceId.indexOf("gov-dept:") === 0) return doGovBuild(state, choiceId.slice("gov-dept:".length));
    if (choiceId.indexOf("stu:") === 0) return doStudents(state, choiceId.slice(4));
    if (choiceId.indexOf("pick:") === 0) {
      const parts = choiceId.split(":");
      const action = parts[1];
      const arg = parts.slice(2).join(":");
      state.scene = null;
      state.queue = [];
      state.phase = "play";
      perform(state, action, arg);
      return;
    }
    if (choiceId.indexOf("reviewdept:") === 0) {
      state.queue.unshift(meetingCandidates(state, choiceId.slice("reviewdept:".length)));
      sync(state);
      nextScene(state);
      return;
    }
    const parts = choiceId.split(":");
    const kind = parts[0];
    const id = parts[1];
    const extra = parts[2];
    const teacher = id ? teacherById(state, id) : null;
    if (kind === "meet" && teacher) state.queue.unshift(reviewCard(teacher));
    else if (kind === "clean" && teacher) resolveClean(state, teacher);
    else if (kind === "take" && teacher) resolveTake(state, teacher);
    else if (kind === "skip" && teacher) {
      teacher.loyalty = clamp(teacher.loyalty - 12, 0, 100);
      note(state, teacher.name + "今年没有进入名单。");
    } else if (kind === "help" && teacher) resolveHelp(state, teacher, extra);
    else if (kind === "refuse" && teacher) resolveRefuse(state, teacher);
    else if (kind === "audit" && teacher) {
      addStat(state, "compliance", 10);
      addStat(state, "reputation", 2);
      removeTeacher(state, teacher, -8);
      note(state, teacher.name + "被审计带走，" + DEPTS.find((d) => d.id === teacher.dept).name + "空了一块。");
    } else if (kind === "refund" && teacher) {
      state.funds = clamp(state.funds + 8, 0, 220);
      addStat(state, "compliance", 4);
      teacher.leverage = true;
      teacher.loyalty = clamp(teacher.loyalty - 8, 0, 100);
      addStat(state, "heat", 6);
      note(state, "钱退回来了，" + teacher.name + "也记住了你知道这件事。");
    } else if (kind === "skim" && teacher) {
      state.funds = clamp(state.funds + 16, 0, 220);
      giveLeverage(state, teacher, 14);
      note(state, "差价进了学校的账，把柄在" + teacher.name + "手里。");
    } else if (kind === "keep" && teacher) {
      if (state.funds < 8) addStat(state, "reputation", -2);
      else state.funds -= 8;
      teacher.loyalty = clamp(teacher.loyalty + 15, 0, 100);
      shiftRival(state, -4, "加薪留下了" + teacher.name + "。");
    } else if (kind === "letgo" && teacher) {
      const trail = maybeDelayedReport(state, teacher);
      removeTeacher(state, teacher, -9);
      shiftRival(state, 8, teacher.name + "去了别的学校。" + trail);
    } else if (kind === "grant-sci") {
      bumpDept(state, "sci", 6);
      addStat(state, "academic", 2);
      bumpDept(state, "med", -3);
      note(state, "省里的钱进了理学。医学薄了一截。");
    } else if (kind === "grant-weak" && id) {
      const meta = DEPTS.find((d) => d.id === id);
      bumpDept(state, id, 6);
      if (state.funds >= 6) state.funds -= 6;
      else addStat(state, "reputation", -3);
      note(state, "拨款补给了最短的" + (meta ? meta.name : "系") + "。经费让出一截。");
    } else if (kind === "grant-fund") {
      state.funds = clamp(state.funds + 14, 0, 220);
      addStat(state, "reputation", -3);
      note(state, "拨款先存进了经费。声誉掉了一截。");
    } else if (kind === "contest-rep") {
      addStat(state, "reputation", 5);
      addStat(state, "academic", -2);
      note(state, "奖杯记在声誉上。学术让了一截。");
    } else if (kind === "contest-depts") {
      bumpDept(state, "sci", 3);
      bumpDept(state, "eng", 3);
      addStat(state, "teaching", -2);
      note(state, "奖杯记到理学和工学。教学让了一截。");
    } else if (kind === "rank-take") {
      addStat(state, "compliance", 3);
      addStat(state, "enrollment", -4);
      note(state, "对外按榜上的名次说。报考热度掉了一截。");
    } else if (kind === "rank-spin") {
      if (state.funds >= 6) state.funds -= 6;
      else addStat(state, "enrollment", -2);
      addStat(state, "reputation", 4);
      addStat(state, "compliance", -3);
      note(state, "口径改过了。声誉回来一点，风纪往下。");
    }
    else if (kind === "story") resolveStory(state, id);
    else if (kind === "chair") resolveChair(state, id, extra);
    else if (kind === "congress") resolveCongress(state, id, extra);
    else if (kind === "party") resolveParty(state, id);
    else if (kind === "crisis-coop") return resolveCrisis(state, "coop");
    else if (kind === "crisis-blame") return resolveCrisis(state, "blame");
    else if (kind === "crisis-refuse") return resolveCrisis(state, "refuse");
    sync(state);
    nextScene(state);
  }

function feedback(state, title, body) {
  state.queue.unshift(scene(title, body, cont()));
}

function resolveClean(state, teacher) {
  const meta = DEPTS.find((d) => d.id === teacher.dept);
  if (teacher.talent >= 58) {
    teacher.rank = Math.min(3, teacher.rank + 1);
    bumpDept(state, teacher.dept, 4);
    addStat(state, "academic", 3);
    teacher.loyalty = clamp(teacher.loyalty + 6, 0, 100);
    note(state, teacher.name + "按标准升为" + RANKS[teacher.rank] + "。");
    rememberProf(state, teacher, "merit");
    feedback(state, "按标准过了", meta.name + teacher.name + "升为" + RANKS[teacher.rank] + "。这个系和学术都吃到了实处。");
  } else if (teacher.talent >= 45) {
    teacher.rank = Math.min(3, teacher.rank + 1);
    bumpDept(state, teacher.dept, 2);
    rememberProf(state, teacher, "merit");
    note(state, teacher.name + "勉强过了，" + meta.name + "只稳了一点。");
    feedback(state, "勉强过线", "成果只够抬一点" + meta.name + "。学术栏几乎没动。");
  } else {
    teacher.loyalty = clamp(teacher.loyalty - 18, 0, 100);
    rememberProf(state, teacher, "refused");
    note(state, teacher.name + "没过。成果确实不够。");
    feedback(state, "退回了", teacher.name + "没有进入名单。他记住了这件事。");
  }
}

function resolveTake(state, teacher) {
  teacher.rank = Math.min(3, teacher.rank + 1);
  state.funds = clamp(state.funds + 12, 0, 220);
  bumpDept(state, teacher.dept, 5);
  if (teacher.talent >= 62) addStat(state, "academic", 2);
  giveLeverage(state, teacher, 12);
  rememberProf(state, teacher, "taken");
  note(state, "你收了" + teacher.name + "的好处。把柄留下了。");
  feedback(state, "钱进了学校，把柄进了别人手里", teacher.name + "升为" + RANKS[teacher.rank] + "。之后他再来找你，不帮，就可能离职或者举报。举报会直接伤综合评分。");
}

function resolveHelp(state, teacher, ask) {
  const meta = DEPTS.find((d) => d.id === teacher.dept);
  if (ask === "audit") {
    addStat(state, "compliance", -8);
    addStat(state, "heat", 6);
    teacher.loyalty = clamp(teacher.loyalty + 8, 0, 100);
    rememberProf(state, teacher, "helped");
    note(state, "审计今年没进" + meta.name + "。" + teacher.name + "没有升职，把柄还在。");
    feedback(state, "审计绕开了", "行程上划掉了" + meta.name + "。账还是那个洞。他没有升职，风纪下去，把柄还在。");
    return;
  }
  if (ask === "quota") {
    bumpDept(state, teacher.dept, 3);
    if (state.funds >= 8) state.funds -= 8;
    else addStat(state, "reputation", -3);
    addStat(state, "heat", 4);
    teacher.loyalty = clamp(teacher.loyalty + 8, 0, 100);
    rememberProf(state, teacher, "helped");
    note(state, teacher.name + "的学生留了下来。经费让出一截，他本人没有升职。");
    feedback(state, "名额给了学生", meta.name + "稳了一点。钱从学校账上走。他本人没有升职，把柄还在。");
    return;
  }
  teacher.rank = Math.min(3, teacher.rank + 1);
  bumpDept(state, teacher.dept, 5);
  addStat(state, "academic", -3);
  addStat(state, "heat", 10);
  addStat(state, "compliance", -6);
  teacher.loyalty = clamp(teacher.loyalty + 10, 0, 100);
  rememberProf(state, teacher, "helped");
  note(state, "你把" + teacher.name + "写进了名单。系更强，学术下降，把柄还在。");
  feedback(state, "名字进了名单", meta.name + teacher.name + "升为" + RANKS[teacher.rank] + "。学术水分和把柄风险也记上一笔。他手里的东西还在。");
}

  function resolveRefuse(state, teacher) {
    const hum = deptById(state, "hum").strength;
    let reportP = 0.36 + (hum >= 60 ? 0.14 : 0) + (teacher.greed >= 80 ? 0.1 : 0) + (teacher.loyalty < 40 ? 0.08 : 0);
    reportP = Math.min(0.72, reportP);
    const roll = Math.random();
    if (roll < reportP) {
      const heavy = hum >= 60 || state.inspections > 0;
      reportPlayer(state, teacher, heavy ? 14 : 10);
      note(state, teacher.name + "把事情举报了出去。学校综合评分被重估。");
      feedback(state, "实名信送出去了", teacher.name + "没有离职。信先到了。综合评分上的伤会留好几年，风纪和声誉一起往下掉。");
      return;
    }
    if (roll < reportP + 0.34) {
      const meta = DEPTS.find((d) => d.id === teacher.dept);
      removeTeacher(state, teacher, -8);
      addStat(state, "reputation", -2);
      note(state, teacher.name + "辞职离开" + meta.name + "，把柄没有递出去。");
      feedback(state, "人走了", "实验室的钥匙留在桌上。这个系立刻薄了一截，信没有送出去。");
      return;
    }
    teacher.loyalty = clamp(teacher.loyalty - 20, 0, 100);
    addStat(state, "heat", 6);
    addStat(state, "reputation", -3);
    rememberProf(state, teacher, "quiet");
    note(state, teacher.name + "没声张，评议会上的用词变了。");
    feedback(state, "他先忍着", "把柄还在。文法系越强，这种安静越短。");
  }

  function enrollmentReason(state, ctx) {
    const bits = [];
    if (ctx.biz >= 52) bits.push("经管把简章托住了");
    else if (ctx.biz < 26) bits.push("经管太弱");
    if (ctx.med >= 42) bits.push("医学写进了社会服务");
    else if (ctx.med < 24) bits.push("医学仍然偏弱");
    if (ctx.min < 16) bits.push("最短的系被写进评估");
    if (state.reports > 0 || state.wound > 0) bits.push("举报还压着招生");
    if (ctx.extra < 0) bits.push("公开事件还在起作用");
    else if (ctx.extra > 0) bits.push("去年的公开处理把人拉回来一点");
    if (!bits.length) bits.push("没有新的招生事故");
    return bits.join("，") + "。";
  }

  function applyEnrollment(state) {
    const biz = deptById(state, "biz").strength;
    const med = deptById(state, "med").strength;
    const min = Math.min(...state.depts.map((d) => d.strength));
    let delta = 0;
    if (biz >= 52) delta += 2;
    else if (biz >= 38) delta += 1;
    else if (biz < 26) delta -= 2;
    if (med >= 42) delta += 2;
    else if (med >= 30) delta += 1;
    else if (med < 20) delta -= 2;
    else if (med < 24) delta -= 1;
    if (min < 16) delta -= 2;
    if (state.wound > 0) delta -= 2;
    if (state.reports > 0) delta -= 1;
    const extra = state.story && state.story.enrollMod ? state.story.enrollMod : 0;
    if (state.story) state.story.enrollMod = 0;
    delta += extra;
    const before = state.enrollment || 0;
    state.enrollment = clamp(before + delta, 0, 100);
    const moved = state.enrollment - before;
    note(state, "报考热度 " + (moved > 0 ? "+" : "") + moved + "。" + enrollmentReason(state, { biz, med, min, extra }));
  }

  function jobsScore(state) {
    const eng = deptById(state, "eng").strength;
    const biz = deptById(state, "biz").strength;
    const cs = deptById(state, "cs").strength;
    const med = deptById(state, "med").strength;
    const minDept = state.depts.slice().sort(function (a, b) { return a.strength - b.strength; })[0];
    const reported = state.opening && state.opening.reports != null && state.reports > state.opening.reports;
    let score = 0;
    if (eng >= 32) score += 1;
    if (eng >= 52) score += 1;
    if (biz >= 32) score += 1;
    if (biz >= 52) score += 1;
    if (state.teaching >= 45) score += 1;
    if (state.tier >= 1) score += 1;
    if (state.pushedJobs || (state.strategy === "applied" && state.year <= (state.strategyUntil || 0))) score += 1;
    if (minDept.strength < 18) score -= 1;
    if (state.wound >= 11 || reported) score -= 1;
    const band = score <= 1 ? "hard" : score >= 4 ? "good" : "mid";
    return { score: score, band: band, eng: eng, biz: biz, cs: cs, med: med, minDept: minDept, reported: reported };
  }

  function jobsEffect(tier, band) {
    const high = tier >= 2;
    if (band === "hard") {
      if (high) return [{ key: "reputation", n: -3 }, { key: "compliance", n: -1 }];
      if (tier === 1) return [{ key: "enrollment", n: -2 }, { key: "reputation", n: -2 }];
      return [{ key: "enrollment", n: -3 }];
    }
    if (band === "mid") return high ? [{ key: "reputation", n: 1 }] : [];
    if (high) return [{ key: "reputation", n: 3 }];
    if (tier === 1) return [{ key: "enrollment", n: 2 }, { key: "reputation", n: 2 }];
    return [{ key: "enrollment", n: 2 }, { key: "reputation", n: 1 }];
  }

  function jobsEffectText(effects) {
    const names = { enrollment: "报考", reputation: "声誉", compliance: "风纪" };
    if (!effects.length) return "";
    return effects.map(function (e) { return names[e.key] + " " + (e.n > 0 ? "+" : "") + e.n; }).join("，") + "。";
  }

  function jobsPicture(state, info) {
    if (info.band === "good") {
      if (info.eng >= 52 && state.pushedJobs) return "你在招聘会上站过。市建工把名额从一个组加到了机电班整班。";
      if (info.eng >= 52) return "机电班整班进了市建工。招聘会那天，安全帽比三方协议先到。";
      if (info.cs >= 52 && state.tier >= 2) return "软件班有人进了合作校的项目组，更多人去了沪上的实验室。";
      if (info.cs >= 52) return "软件班大多去了软件园的外包。合同能签，封面还写不上学校。";
      if (info.biz >= 52) return "会计班一半进了江城银行的柜台，一半去了校友开的厂。";
      if (info.med >= 45) return "临床班去了市医院和两家县医院。评估材料里，社会服务这一栏终于能写满。";
      if (state.teaching >= 45) return "普通班也能签到本地的岗。单位要的是能上手的人，不是牌子。";
      if (state.pushedJobs) return "你在招聘会上站过。市建工把名额从一个组加到了机电班整班。";
      return "牌子比班里的成绩更好用。单位按学校的档来要人。";
    }
    if (info.band === "mid") {
      if (state.pushedJobs && info.eng < 52 && info.biz < 52) return "招聘会把人从家里拉出来了。签的多是本地小厂和柜台，简章只能写「大部分有去处」。";
      if (state.tier >= 1 && info.eng < 52 && info.biz < 52) return "牌子比去年好写。班里仍是有人去银行，有人回县城，拉不开差距。";
      return "机电班签了一部分市建工，会计班还在等城商行的二面。没有整班落空，也没有整班被要走。";
    }
    if (info.reported || state.wound >= 11) return "原本说好的银行岗位撤了。举报信比成绩单先到人事那里。";
    if (info.minDept.strength < 18) return "招工的人问到" + deptName(info.minDept.id) + "，桌子后面就没有下文了。别的班再好，简章上也得把这一笔写上。";
    if (info.eng < 32) return "机电班的三方协议只收回来几份。厂里的人看过实训室，没留电话。";
    if (info.biz < 32) return "会计班等城商行等到散会。校友那边说，今年没有坑。";
    if (info.cs < 32) return "软件班投出去的简历停在软件园门口。外包公司要能干活的，不要再培训一届的。";
    if (info.med < 24) return "临床班能去的只剩卫生院。市医院的名额给了别的学校。";
    return "班里签出去的岗位零散。招聘会散了，三方协议还空着一大半。";
  }

  function applyJobs(state) {
    const info = jobsScore(state);
    const effects = jobsEffect(state.tier, info.band);
    effects.forEach(function (e) { addStat(state, e.key, e.n); });
    const bandName = info.band === "hard" ? "难找工作" : info.band === "good" ? "去处稳" : "去处平常";
    state.lastJobs = bandName;
    note(state, "就业：" + bandName + "。" + jobsEffectText(effects) + jobsPicture(state, info));
  }

  function bulletinLines(state, before) {
    const names = {
      score: "综合评分",
      academic: "学术",
      teaching: "教学",
      reputation: "声誉",
      funds: "经费",
      compliance: "风纪",
      heat: "把柄风险",
      wound: "举报创伤",
      international: "国际影响",
      enrollment: "报考热度"
    };
    const lines = [];
    Object.keys(names).forEach((key) => {
      const from = before[key] || 0;
      const to = state[key] || 0;
      if (from === to) return;
      const diff = to - from;
      if (key === "funds") {
        lines.push(names[key] + "  " + wan(from) + " → " + wan(to) + "（" + wanSigned(diff) + "）");
        return;
      }
      lines.push(names[key] + "  " + from + " → " + to + "（" + (diff > 0 ? "+" : "") + diff + "）");
    });
    state.depts.forEach((d) => {
      const prev = (before.depts || []).find((x) => x.id === d.id);
      if (!prev || prev.strength === d.strength) return;
      const diff = d.strength - prev.strength;
      lines.push(deptName(d.id) + "  " + prev.strength + " → " + d.strength + "（" + (diff > 0 ? "+" : "") + diff + "）");
    });
    if (!lines.length) lines.push("六个系和主要数字这一年没有移动。");
    lines.push("原因");
    const notes = state.yearNotes || [];
    const shown = notes.length > 12 ? notes.slice(-12) : notes;
    if (!shown.length) lines.push("没有额外说明。");
    shown.forEach((line) => lines.push(line));
    return lines;
  }

  function settleYear(state) {
    const before = state.opening || {
      score: state.score,
      academic: state.academic,
      teaching: state.teaching,
      reputation: state.reputation,
      funds: state.funds,
      compliance: state.compliance,
      heat: state.heat,
      wound: state.wound,
      international: state.international,
      enrollment: state.enrollment || 0,
      depts: state.depts.map((d) => ({ id: d.id, strength: d.strength }))
    };
    const hit = impact(state);
    state.academic = clamp(state.academic + 1 + hit.mods.academic, 0, 100);
    state.teaching = clamp(state.teaching + hit.mods.teaching, 0, 100);
    state.reputation = clamp(state.reputation + hit.mods.reputation, 0, 100);
    state.funds = clamp(state.funds + 12 + hit.mods.funds, 0, 220);
    state.international = clamp(state.international + hit.mods.international, 0, 100);
    state.compliance = clamp(state.compliance + hit.mods.compliance + (leverageTeachers(state).length ? -3 : 2), 0, 100);
    state.heat = clamp(state.heat + leverageTeachers(state).length * 4 - (leverageTeachers(state).length ? 0 : 4), 0, 100);
    if (state.wound > 0) state.wound = Math.max(0, state.wound - 2);
    state.teachers.forEach((t) => {
      if (!t.skimming && t.greed >= 74 && state.compliance < 70 && Math.random() < 0.34) t.skimming = true;
    });
    state.depts.forEach((d) => {
      if (!deptTeachers(state, d.id).length) {
        d.strength = clamp(d.strength - 4, 0, 100);
        note(state, deptName(d.id) + "没有带头人，年底掉了 4。");
      }
    });
    applyEnrollment(state);
    applyJobs(state);
    applyCampusYear(state);
    applyStrategyYear(state);
    applyPolicyYear(state);
    applyLoanYear(state);
    ensureExtras(state);
    state.rivalMomentum = clamp((state.rivalMomentum || 0) + 2, 0, 100);
    note(state, "对面势头 +2，现在 " + state.rivalMomentum + "。");
    hit.lines.forEach((line) => note(state, line));
    sync(state);
    state.afterEvents = false;
    state.phase = "scene";
    state.queue = [];
    state.scene = scene(
      "第 " + state.year + " 年公报",
      "这一年动过的数字，和原因。",
      [{ id: "bulletin", label: "继续下一年" }],
      { lines: bulletinLines(state, before), kind: "bulletin" }
    );
  }

  function applyCampusYear(state) {
    const campus = campusOf(state);
    const industry = buildingCount(state, "industry");
    const hospital = buildingCount(state, "hospital");
    const points = (state.masterPoints || []).length;
    if (industry) {
      state.funds = clamp(state.funds + industry * 4, 0, 220);
      const eng = deptById(state, "eng");
      const biz = deptById(state, "biz");
      const target = eng.strength <= biz.strength ? "eng" : "biz";
      bumpDept(state, target, industry * 3);
      note(state, "产教基地进了 " + wan(industry * 4) + "，" + deptName(target) + " +" + (industry * 3) + "。");
    }
    if (hospital) {
      state.funds = clamp(state.funds - hospital * 3, 0, 220);
      note(state, "附属医院今年吃掉 " + wan(hospital * 3) + "。");
    }
    if (points) {
      state.funds = clamp(state.funds + points * 3, 0, 220);
      note(state, "专业硕士点带来 " + wan(points * 3) + "。");
    }
    const tuition = Math.floor((campus.students || 0) / 1000) * 2;
    if (tuition) {
      state.funds = clamp(state.funds + tuition, 0, 220);
      note(state, "学费按在校生进来 " + wan(tuition) + "。");
    }
    if ((campus.students || 0) > capacityOf(state)) {
      const drop = buildingCount(state, "gym") ? 1 : 2;
      addStat(state, "compliance", -drop);
      note(state, "在校生超过宿舍和占地能装下的数，风纪掉了 " + drop + "。");
    }
  }

  function startNextYear(state, line) {
    state.year += 1;
    state.season = 0;
    state.actionsLeft = 1;
    state.used = {};
    state.facedStudents = false;
    state.phase = "play";
    state.scene = null;
    state.queue = [];
    const delivered = takeDelivery(state);
    markOpening(state);
    if (delivered) note(state, delivered.name + "交付了。" + delivered.detail + "。");
    if (line) note(state, line);
    if (state.year === 6 || state.year === 11) {
      state.phase = "scene";
      state.scene = strategyScene(state, false);
    } else if (state.year === 8 && !state.policy) {
      rollPolicy(state);
      state.phase = "scene";
      state.scene = policyScene(state);
    } else if (state.year === 13 && !state.succession) {
      state.phase = "scene";
      state.scene = successionScene(state);
    }
  }

  function applyStrategyYear(state) {
    if (!state.strategy || state.year > (state.strategyUntil || 0)) return;
    if (state.strategy === "research") {
      addStat(state, "academic", 2);
      bumpDept(state, "sci", 2);
      addStat(state, "teaching", -1);
      state.funds = clamp(state.funds - 2, 0, 220);
      note(state, "研究型规划：学术 +2，理学 +2，教学 -1，经费 -20万。");
    } else if (state.strategy === "applied") {
      bumpDept(state, "eng", 2);
      addStat(state, "international", -1);
      note(state, "应用型规划：工学 +2，就业按保过一档算，国际影响 -1。");
    } else if (state.strategy === "medical") {
      bumpDept(state, "med", 2);
      addStat(state, "reputation", 2);
      state.funds = clamp(state.funds - 3, 0, 220);
      note(state, "医科规划：医学 +2，声誉 +2，经费 -30万。");
    } else if (state.strategy === "world") {
      addStat(state, "international", 3);
      state.funds = clamp(state.funds - 4, 0, 220);
      note(state, "国际化规划：国际影响 +3，经费 -40万。");
    } else if (state.strategy === "industry") {
      state.funds = clamp(state.funds + 4, 0, 220);
      addStat(state, "enrollment", 2);
      addStat(state, "academic", -1);
      bumpDept(state, "sci", -1);
      note(state, "产业型规划：经费 +40万，报考 +2，学术 -1，理学 -1。");
    }
  }

  function applyPolicyYear(state) {
    if (state.policy !== "major" || !state.policyDept) return;
    const dept = deptById(state, state.policyDept);
    if (!dept) return;
    const min = Math.min.apply(null, state.depts.map(function (d) { return d.strength; }));
    if (dept.strength > min) return;
    addStat(state, "enrollment", -2);
    note(state, deptName(state.policyDept) + "还在垫底，报考材料不好写。报考 -2。");
  }

  function applyLoanYear(state) {
    if (!(state.loanYears > 0)) return;
    const pay = state.loanPayment || 4;
    state.funds = clamp(state.funds - pay, 0, 220);
    state.loanYears -= 1;
    note(state, "还贷 " + wan(pay) + "。还剩 " + state.loanYears + " 年。");
  }

  function afterBulletin(state) {
    const crisis = crisisScene(state);
    if (crisis) {
      state.phase = "scene";
      state.scene = crisis;
      state.queue = [];
      return;
    }
    const ending = checkEnding(state, false);
    if (ending) {
      state.ending = ending;
      state.mode = "end";
      return;
    }
    if (state.year >= YEARS) {
      state.ending = checkEnding(state, true);
      state.mode = "end";
      return;
    }
    startNextYear(state);
  }

  function crisisScene(state) {
    if (state.heat < 86 && state.wound < 30 && state.score > 12) return null;
    if (state.crisisDone) return null;
    state.crisisDone = true;
    return scene(
      "巡视组进校",
      "综合评分、举报信和校园里的把柄堆到了一起。这一次不是内部巡察。你可以配合，把事情推给教师，或者拒不提供材料。",
      [
        { id: "crisis-coop", label: "配合，处理涉事教师", detail: "评分还要再掉一截，学校有机会留下来" },
        { id: "crisis-blame", label: "把责任推给握有把柄的人", detail: "有一半可能被对方当场咬回来" },
        { id: "crisis-refuse", label: "不配合", detail: "任期大概率停在这里" }
      ]
    );
  }

  function resolveCrisis(state, how) {
    state.scene = null;
    if (how === "coop") {
      addStat(state, "reputation", -6);
      state.wound = clamp(state.wound + 4, 0, 40);
      state.heat = clamp(state.heat - 35, 0, 100);
      addStat(state, "compliance", 14);
      leverageTeachers(state).slice(0, 2).forEach((t) => removeTeacher(state, t, -6));
      sync(state);
    } else if (how === "blame") {
      if (Math.random() < 0.5) {
        state.ending = endingCatalog().scandal;
        state.mode = "end";
        return;
      }
      state.heat = clamp(state.heat - 12, 0, 100);
      state.wound = clamp(state.wound + 6, 0, 40);
      sync(state);
    } else {
      state.ending = endingCatalog().downfall;
      state.mode = "end";
      return;
    }
    if (state.year >= YEARS) {
      state.ending = checkEnding(state, true);
      state.mode = "end";
      return;
    }
    startNextYear(state, how === "coop" ? "你配合了巡视，一批人离开，学校还在。" : "责任先推出去了，信暂时没有第二封。");
  }

  function endingCatalog() {
    return {
      world: end("世界一流", "建成", "十四年后，学校进了 D9，寰球榜也进了前 200。把柄没有在揭牌那天炸开。"),
      d9: end("D9联盟", "D9", "学校进了 D9。986 已经是旧档。榜单、把柄或评分还没到世界一流。"),
      top: end("顶尖学府", "986", "牌子已经是 986。再往上是 D9，这一届没有进。"),
      key: end("国家重点", "212", "学校停在 212 这一档。大专已经过去了。"),
      college: end("升本止步", "本科", "普通本科的牌子拿到了。再往上的学术、理学和排名，这一届没有凑齐。"),
      vocational: end("大专收场", "未升", "十四年用完，学校还是大专。有的系变强了，学校没有升上去。"),
      vocStop: end("职业技术大学", "职本", "职业本科的牌子拿到了。专业硕士点和整合，这一届没有做完。212 的材料从一开始就不收。"),
      proDegree: end("专业学位", "专硕", "职业本科上有了专业硕士点。学校没有往 212 走，这条路本来也走不了。"),
      multiCampus: end("多校区职业大学", "整合", "并进了一所学校，专业硕士点还没有。校名仍是职业技术大学。"),
      vocHead: end("区域职教龙头", "龙头", "两个专业硕士点都在，也整合过一所学校。这是职业本科的尽头，不是 212。"),
      ruined: end("评分崩盘", "重估", "举报和创伤把综合评分打穿。上面不再讨论排名，只讨论这所学校还要不要保留建制。"),
      downfall: end("校长离任", "离任", "巡视没有给你把任期做完的机会。学校的档次停在你离开的那一天。"),
      scandal: end("排名作废", "除名", "你曾经把学校送进榜单。信被公开之后，这一档排名被撤下。"),
      clean: end("清誉调任", "调任", ""),
      warlord: end("学阀架空", "架空", "最强的那个系握着你的把柄，最弱的系已经没人管。校长室还在，议程不是你在定。"),
      hollow: end("人才走空", "空校", "评估组来的时候，实验室是锁着的。"),
      specialty: end("一科成名", "单科", "学校没有挤进 212。有一个系强到业内会单独提起。")
    };
  }

  function end(title, stamp, text) { return { title, stamp, text }; }

  function checkEnding(state, finalYear) {
    const book = endingCatalog();
    const avg = avgDept(state);
    const maxDept = state.depts.slice().sort((a, b) => b.strength - a.strength)[0];
    const minStrength = Math.min(...state.depts.map((d) => d.strength));
    const maxLead = leadOf(state, maxDept.id);
    const band = worldBand(rankScore(state));
    const vacancies = DEPTS.filter((d) => !deptTeachers(state, d.id).length).length;

    if (state.score <= 12 || state.wound >= 32) return book.ruined;
    if (vacancies >= 3 || avg <= 20) return book.hollow;
    if (state.tier >= 1 && state.bestRank >= 5 && state.wound >= 12 && state.reports >= 1) return book.scandal;
    if (state.crisisDone && state.heat >= 92) return book.downfall;

    if (!finalYear && state.year < YEARS) return null;
    const elite = state.track !== "vocational" && state.tier >= 4 && band.index >= 6 && state.heat <= 30 && state.wound <= 8 && state.score >= 74;
    if (elite) return book.world;
    if (maxDept.strength >= 84 && minStrength <= 28 && maxLead && maxLead.leverage) return book.warlord;
    if (state.track === "vocational" && state.tier >= 1) {
      const points = (state.masterPoints || []).length;
      if (points >= 2 && state.merged) return book.vocHead;
      if (points >= 1) return book.proDegree;
      if (state.merged) return book.multiCampus;
      return book.vocStop;
    }
    if (state.tier >= 4) return book.d9;
    if (state.tier >= 3) return book.top;
    if (state.tier >= 2) return book.key;
    if (state.bribes === 0 && state.compliance >= 78 && state.reports === 0) {
      const stem = state.baseName || "这所学校";
      book.clean.text = "你几乎没让把柄留下。上面调你去管另一所学校。" + stem + "升得有限。";
      return book.clean;
    }
    const found = (state.achievements || [])[0];
    if (maxDept.strength >= 80 || (found && maxDept.strength >= 70)) {
      if (found) book.specialty.text = "学校没有挤进 212。" + found.name + "让" + deptName(found.dept) + "被单独提起。";
      return book.specialty;
    }
    if (state.tier >= 1) return book.college;
    return book.vocational;
  }

  function seasonName(state) {
    return SEASONS[state.season || 0];
  }

  function ensureSeason(state) {
    if (!state || !state.depts) return;
    if (state.season == null) {
      state.season = 0;
      if (state.actionsLeft > 1) state.actionsLeft = 1;
    }
  }

  function render(state) {
    if (state.mode === "intro") return renderIntro(state);
    if (state.mode === "end") return renderEnding(state);
    return renderGame(state);
  }

  /* 全局图标：日式治愈系 soft-3D 切片（public/game-assets/assets/icons/campus） */
  const CampusIco = (typeof globalThis !== "undefined" && globalThis.CampusIcons) || null;

  function icon(name, opts) {
    if (CampusIco && CampusIco.icon) return CampusIco.icon(name, opts);
    return "";
  }

  function peopleResourceChips(state) {
    const grade = scoreGrade(state.score);
    const scoreLabel = state.score + " · " + grade;
    return '<div class="campus-resource top-meta people-resources">' +
      '<span class="campus-resource__chip chip is-score">' + icon("star", { tone: "gold", size: 16 }) +
      esc(scoreLabel) + "</span>" +
      '<span class="campus-resource__chip chip is-funds">' + icon("coin", { size: 16 }) + esc(wan(state.funds)) + "</span></div>";
  }

  const Assets = (typeof globalThis !== "undefined" && globalThis.GameAssets) || {};

  function artImg(src, className, alt) {
    if (!src) return "";
    return '<img class="' + (className || "art") + '" src="' + esc(src) + '" alt="' + esc(alt || "") + '" loading="lazy" draggable="false" />';
  }

  function campusArt(bare) {
    const src = bare
      ? (Assets.buildings && Assets.buildings.academic)
      : (Assets.buildings && Assets.buildings["campus-gate"]);
    if (src) {
      return '<span class="skyline art-wrap' + (bare ? " bare" : "") + '">' +
        artImg(src, "art-building", bare ? "教学楼" : "校门") + "</span>";
    }
    const sky = bare ? "" : '<rect width="200" height="88" fill="#d9e7f6"/>';
    const wall = bare ? "#f4f7fb" : "#fbf9f7";
    const glass = bare ? "#9ebfe0" : "#8eb0d4";
    const roof = bare ? "#ffffff" : "#5b8ac7";
    return '<svg class="skyline" viewBox="0 0 200 88" aria-hidden="true">' + sky +
      '<rect y="64" width="200" height="24" fill="' + (bare ? "rgba(255,255,255,.16)" : "#e5f0e2") + '"/>' +
      '<rect x="18" y="36" width="26" height="32" rx="2" fill="' + wall + '"/>' +
      '<rect x="23" y="42" width="5" height="5" fill="' + glass + '"/><rect x="32" y="42" width="5" height="5" fill="' + glass + '"/>' +
      '<rect x="23" y="51" width="5" height="5" fill="' + glass + '"/><rect x="32" y="51" width="5" height="5" fill="' + glass + '"/>' +
      '<rect x="52" y="24" width="42" height="44" rx="2" fill="' + wall + '"/>' +
      '<polygon points="52,24 73,10 94,24" fill="' + roof + '"/>' +
      '<rect x="68" y="42" width="10" height="26" fill="' + roof + '"/>' +
      '<rect x="104" y="32" width="36" height="36" rx="2" fill="' + wall + '"/>' +
      '<rect x="110" y="38" width="7" height="6" fill="' + glass + '"/><rect x="122" y="38" width="7" height="6" fill="' + glass + '"/>' +
      '<rect x="110" y="48" width="7" height="6" fill="' + glass + '"/><rect x="122" y="48" width="7" height="6" fill="' + glass + '"/>' +
      '<rect x="148" y="42" width="24" height="26" rx="2" fill="' + wall + '"/>' +
      '<circle cx="176" cy="30" r="6" fill="#f3e2b8"/>' +
      '</svg>';
  }

  function heroArt(kind) {
    const map = {
      home: Assets.buildings && Assets.buildings.academic,
      gate: Assets.buildings && Assets.buildings["campus-gate"],
      apply: Assets.buildings && Assets.buildings.library,
      principal: Assets.characters && Assets.characters["principal-male"]
    };
    const src = map[kind] || map.home;
    if (!src) return "";
    const cls = kind === "principal" ? "art-character" : "art-building";
    return '<span class="art-wrap hero">' + artImg(src, cls, "") + "</span>";
  }

  function appBar(sub) {
    return '<header class="top"><span class="home">' + icon("cap") + '</span>' +
      '<div class="brand"><b>校长模拟器</b><small>' + sub + '</small></div></header>';
  }

  function resourceChips(state) {
    const grade = scoreGrade(state.score);
    const scoreLabel = state.score + " · " + grade;
    if (UI) {
      return UI.resourceBar([
        { iconHtml: icon("score"), value: scoreLabel },
        { iconHtml: icon("coin"), value: wan(state.funds), tone: "funds" }
      ]);
    }
    return '<div class="top-meta">' +
      '<span class="chip">' + icon("score") + esc(scoreLabel) + '</span>' +
      '<span class="chip funds">' + icon("coin") + esc(wan(state.funds)) + '</span>' +
      '</div>';
  }

  function seasonGreeting(state) {
    const s = seasonName(state);
    if (s === "夏") return { title: "校长，夏天好！", body: "校园正热闹，抓紧这一季把人带起来。" };
    if (s === "秋") return { title: "校长，秋天好！", body: "收成的季节，把师资和账本看仔细。" };
    if (s === "冬") return { title: "校长，冬天好！", body: "沉住气，把队伍稳住，再迎下一春。" };
    return { title: "校长，您好！", body: "新学期开始了，先把校园打理起来吧。" };
  }

  function principalAvatarChip() {
    const art = heroArt("principal");
    if (art) return '<span class="top-avatar">' + art + "</span>";
    return '<span class="top-avatar top-avatar--fallback">' + icon("cap") + "</span>";
  }

  function tile(label, value) {
    const text = String(value);
    return '<div class="tile"><span>' + label + '</span><b' + (text.length > 6 ? ' class="long"' : '') + '>' + esc(text) + '</b></div>';
  }

  function renderIntro(state) {
    const saved = loadRaw();
    return '<div class="shell intro">' + appBar("一届任期 · 十四年") +
      '<section class="intro-hero"><div class="copy"><p class="eyebrow">校园经营</p><h1>从一所大专开始</h1>' +
      '<p class="lede">升本先选路：普通本科可到 212、986、D9；职业本科升完封顶。一年四季，一季一件事。</p></div>' +
      (heroArt("principal") || campusArt(false)) + '</section>' +
      '<section class="card"><h2>这一局怎么走</h2><ul class="rules">' +
      '<li><strong>升档</strong>看路线。普通本科看理学、硕博师资、实验楼和图书馆。职业本科看工学或计算机、双师、实训楼和产教基地。两条路都要占地、宿舍，还要没有实名举报。</li>' +
      '<li><strong>过问</strong>募捐、办公会、找政府、学生事务不占这一季，一年各一次。办了也有代价。</li>' +
      '<li><strong>评审</strong>逢双年必开。同一个系里看成果、看谁夹着信封、看谁握有把柄，名额只有一个。</li>' +
      '<li><strong>把柄</strong>来自你收过的钱。帮，系会变强，风险也在；不帮，他可能离职，也可能举报。</li>' +
      '<li><strong>报考</strong>经管和医学抬热度，短板和举报往下压。热度不够，升本和 212 的材料递不出去。地和楼不够，材料同样递不出去。</li>' +
      '</ul></section>' +
      '<p class="eyebrow">这一所学校</p>' +
      '<div class="origins">' +
      '<button type="button" data-act="origin" data-arg="old"' + (origin === "old" ? ' class="on"' : '') + '><b>老专科</b><small>工学和经管有一点底，账上是寻常的一笔。</small></button>' +
      '<button type="button" data-act="origin" data-arg="trade"' + (origin === "trade" ? ' class="on"' : '') + '><b>行业学校</b><small>工学和医学更高。硕博师资少，经费更紧。</small></button>' +
      '<button type="button" data-act="origin" data-arg="college"' + (origin === "college" ? ' class="on"' : '') + '><b>备升本的学院</b><small>理学和教学高一点。桌上有一份旧材料，风险不是从零开始。</small></button>' +
      '</div>' +
      '<label for="school">学校的名字</label>' +
      '<input id="school" type="text" maxlength="12" value="江湾" />' +
      '<div class="choices">' +
      (UI
        ? UI.button({ variant: "primary", label: "开始任期", attrs: { "data-act": "start" } })
        : '<button class="primary" data-act="start">开始任期</button>') +
      (saved
        ? (UI
          ? UI.button({ variant: "secondary", label: "继续上一届", block: true, attrs: { "data-act": "continue" } })
          : '<button data-act="continue">继续上一届</button>')
        : '') +
      '</div></div>';
  }

  let screen = "do";
  let peopleFilter = "all";
  let peopleFilterOpen = false;
  let peopleDetailId = null;
  let peoplePane = "overview";
  let schoolPane = "overview";
  let doPane = "tasks";
  let applyGateFilter = "all";
  let applyExpandId = null;
  let origin = "old";

  const NAV = [["do", "办事", "tasks"], ["school", "学校", "school"], ["people", "教师", "teachers"], ["apply", "申报", "apply"]];

  function scoreGrade(score) {
    if (score >= 90) return "A+";
    if (score >= 80) return "A";
    if (score >= 70) return "B+";
    if (score >= 60) return "B";
    if (score >= 45) return "C";
    return "D";
  }

  function renderGame(state) {
    return '<div class="shell play">' + sideNav() +
      '<div class="main">' + topBar(state) + '<div class="sheet">' + sheetHtml(state) + '</div></div>' +
      tabBar() + '</div>';
  }

  function sideNav() {
    return '<aside class="side"><div class="sidetop">' + icon("cap") + '<b>校长模拟器</b></div><nav>' +
      NAV.map(function (item) {
        return '<button type="button" data-act="tab" data-arg="' + item[0] + '"' +
          (screen === item[0] ? ' class="on"' : '') + '>' + icon(item[2]) + '<span>' + item[1] + '</span></button>';
      }).join("") + '</nav>' + campusArt(true) + '</aside>';
  }

  function tabBar() {
    if (UI) {
      return UI.bottomNav({
        active: screen,
        items: NAV.map(function (item) {
          return { id: item[0], label: item[1], iconHtml: icon(item[2]) };
        })
      });
    }
    return '<nav class="tabs">' + NAV.map(function (item) {
      return '<button type="button" data-act="tab" data-arg="' + item[0] + '"' +
        (screen === item[0] ? ' class="on"' : '') + '>' + icon(item[2]) + '<span>' + item[1] + '</span></button>';
    }).join("") + '</nav>';
  }

  function topBar(state) {
    if (screen === "do" && state.scene) {
      const title = state.scene.kind === "bulletin" ? "本年总结" : "要你拍板";
      return '<header class="top"><b>' + title + '</b>' + resourceChips(state) + '</header>';
    }
    if (screen === "do") {
      return '<header class="top top--ghost top--do" aria-hidden="true"></header>';
    }
    if (screen === "people" && peopleDetailId) {
      return '<header class="top top--spring"><button type="button" class="back" data-act="teacher-back" aria-label="返回名册">' + icon("back", { size: 20 }) + '</button>' +
        principalAvatarChip() +
        '<div class="brand"><b>教师详情</b><small>' + esc(state.schoolName) + '</small></div>' +
        peopleResourceChips(state) + '</header>';
    }
    if (screen === "people") {
      return '<header class="top top--ghost"><button type="button" class="back" data-act="tab" data-arg="do" aria-label="返回">' + icon("back", { size: 20 }) + '</button></header>';
    }
    const titles = { school: "学校", apply: "申报" };
    return '<header class="top"><button type="button" class="back" data-act="tab" data-arg="do" aria-label="返回">' + icon("back") + '</button>' +
      '<b>' + titles[screen] + '</b>' + resourceChips(state) + '</header>';
  }

  function sheetHtml(state) {
    if (screen === "school") return schoolSheet(state);
    if (screen === "people") return peopleSheet(state);
    if (screen === "apply") return applySheet(state);
    return doSheet(state);
  }

  function pendingBanner(state) {
    if (!state.scene || screen === "do") return "";
    return '<button class="pending" data-act="tab" data-arg="do">有一件事等你拍板</button>';
  }

  function coreStats(state) {
    return '<div class="core-stats">' +
      statCard("score", "综合评分", state.score) +
      statCard("coin", "经费", wan(state.funds)) +
      statCard("students", "报考热度", state.enrollment || 0) +
      statCard("shield", "风纪", state.compliance) +
      '</div>';
  }

  function moreStats(state) {
    const heat = state.heat >= 80 ? "bad" : state.heat >= 55 ? "near" : "";
    const wound = state.wound >= 30 ? "bad" : state.wound >= 16 ? "near" : "";
    return '<div class="more-stats">' +
      miniStat("book", "学术", state.academic) +
      miniStat("world", "国际", state.international) +
      miniStat("teach", "教学", state.teaching) +
      miniStat("voice", "声誉", state.reputation) +
      miniStat("inspect", "把柄", state.heat, heat) +
      miniStat("office", "创伤", state.wound, wound) +
      '</div>';
  }

  function numberStrip(state) {
    return coreStats(state) + moreStats(state);
  }

  function yearEventsList(state) {
    const chronicle = chronicleOf(state).slice().reverse();
    const rows = [];
    chronicle.forEach(function (bucket) {
      const current = bucket.year === state.year;
      const notes = bucket.notes && bucket.notes.length
        ? bucket.notes
        : (current ? ["这一年还在开篇，董事会刚把印交过来。"] : ["这一年没有留下备忘。"]);
      notes.forEach(function (line) {
        rows.push({
          year: bucket.year,
          current: current,
          text: line
        });
      });
    });
    return '<section class="campus-card card soft do-events">' +
      '<div class="card-head do-section__head">' + icon("calendar", { size: 16 }) +
      '<h2>每年做的事情</h2><span class="meta">按年备忘</span></div>' +
      '<ul class="do-events__list">' + rows.map(function (row) {
        return '<li class="do-events__item' + (row.current ? " is-now" : "") + '">' +
          '<span class="do-events__year">第' + row.year + '年</span>' +
          '<p>' + esc(row.text) + '</p></li>';
      }).join("") + '</ul></section>';
  }

  function yearResultsPane(state) {
    const passed = state.season || 0;
    const pct = Math.round((passed / 4) * 100);
    const grade = scoreGrade(state.score);
    const chronicle = chronicleOf(state).slice().reverse();
    const blocks = chronicle.map(function (bucket) {
      const current = bucket.year === state.year;
      const notes = bucket.notes && bucket.notes.length
        ? '<ul class="log">' + bucket.notes.map(function (line) { return '<li>' + esc(line) + '</li>'; }).join("") + '</ul>'
        : '<p class="meta">这一年还没有结算备忘。</p>';
      return '<section class="do-result-year' + (current ? " is-now" : "") + '">' +
        '<div class="do-result-year__head"><h3>第 ' + bucket.year + ' 年' + (current ? " · 今年" : "") + '</h3>' +
        (current
          ? '<span class="do-result-year__pill">' + seasonName(state) + ' · 过完 ' + passed + ' 季</span>'
          : '<span class="do-result-year__pill">已过完</span>') +
        '</div>' + notes + '</section>';
    }).join("");
    return '<section class="campus-card card soft do-section do-results">' +
      '<div class="card-head do-section__head">' + icon("growth", { size: 18 }) +
      '<h2>每年的结果</h2><span class="meta">年度回顾</span></div>' +
      '<div class="do-results__summary">' +
      '<div class="do-results__score"><b>' + state.score + '<em>/100</em></b><span class="do-results__grade">' + grade + '</span>' +
      '<p>第 ' + state.year + ' 年 · ' + tierLabel(state) + '</p></div>' +
      '<div class="do-results__ring ring sm" style="--p:' + pct + '"><span><b>' + pct + '</b><em>%</em></span></div>' +
      '</div>' +
      '<div class="do-results__years">' + blocks + '</div></section>';
  }

  function miniStat(iconName, label, value, tone) {
    if (UI) return UI.statCard({ iconHtml: icon(iconName), label: label, value: value, tone: tone || "" });
    return '<div class="' + (tone || "") + '"><span class="pico">' + icon(iconName) + '</span><b>' + value + '</b><em>' + label + '</em></div>';
  }

  function statCard(iconName, label, value, tone) {
    if (UI) return UI.statCard({ iconHtml: icon(iconName), label: label, value: value, tone: tone || "" });
    return '<div class="stat-card ' + (tone || "") + '"><span class="pico">' + icon(iconName) + '</span><b>' + value + '</b><em>' + label + '</em></div>';
  }

  function glanceLine(state) {
    const nums = "评分 " + state.score + " · 经费 " + wan(state.funds) + " · 报考 " + (state.enrollment || 0) + " · 风纪 " + state.compliance;
    const depts = state.depts.map((d) => deptName(d.id) + " " + d.strength).join(" · ");
    return '<p class="glance">' + nums + " · " + depts + "</p>";
  }

  function powerBlock(state) {
    const grade = scoreGrade(state.score);
    const sides = [
      ["build", "经营", wan(state.funds)],
      ["students", "招生", String(state.enrollment || 0)],
      ["voice", "舆论", String(state.compliance)]
    ];
    return '<div class="do-power__main school-power__main">' +
      '<div class="do-power__grade" aria-label="评级 ' + grade + '"><span>' + grade + '</span></div>' +
      '<div class="do-power__score"><b>' + state.score + '<em>/100</em></b>' +
      '<p>第 ' + state.year + ' 年 · ' + seasonName(state) + ' · ' + tierLabel(state) + '</p></div>' +
      '<div class="do-power__side">' + sides.map(function (s) {
        return '<div class="do-power__stat"><span class="do-power__ico">' + icon(s[0], { size: 16 }) +
          '</span><em>' + s[1] + '</em><b>' + s[2] + '</b></div>';
      }).join("") + '</div></div>';
  }

  function doPaneTabs() {
    const items = [
      ["tasks", "待办事项", "tasks"],
      ["results", "每年的结果", "growth"],
      ["inquiry", "今年过问", "office"]
    ];
    return '<div class="quick-nav do-quick do-pane-tabs" role="tablist">' + items.map(function (item) {
      const on = doPane === item[0];
      return '<button type="button" role="tab" class="quick-item' + (on ? " is-on" : "") +
        '" data-act="do-pane" data-arg="' + item[0] + '"' + (on ? ' aria-selected="true"' : "") + '>' +
        '<span class="quick-ico">' + icon(item[2], { size: 22 }) + '</span><em>' + item[1] + '</em></button>';
    }).join("") + '</div>';
  }

  function doPaneBody(state, season, inquiry) {
    if (doPane === "results" || doPane === "year") return yearResultsPane(state);
    if (doPane === "inquiry") {
      return '<section class="campus-card card soft do-section">' +
        '<div class="card-head do-section__head">' + icon("office", { size: 18 }) +
        '<h2>今年过问</h2><span class="meta">不占本季</span></div>' +
        inquiryGrid(state, inquiry) + '</section>';
    }
    return '<section class="campus-card card soft do-section do-section--tasks">' +
      '<div class="card-head do-section__head">' + icon("tasks", { size: 18 }) +
      '<h2>待办事项</h2><span class="meta">这一季</span></div>' +
      taskCards(state, season) + '</section>';
  }

  function taskStatus(state, a) {
    const used = !!(a.once && state.used[a.id]);
    const locked = !!(a.disabled || state.funds < a.cost || (!a.free && state.actionsLeft <= 0));
    if (used) return { kind: "done", cta: "本季已完成", disabled: true, tag: "" };
    if (a.disabled) return { kind: "lock", cta: "条件未达成", disabled: true, tag: "" };
    if (locked) return { kind: "lock", cta: "暂不可", disabled: true, tag: "" };
    return { kind: "open", cta: "去处理", disabled: false, tag: "待处理" };
  }

  function taskCards(state, list) {
    const icons = { build: "build", campus: "campus", recruit: "recruit", world: "world", donate: "donate", office: "office", gov: "gov", students: "students", inspect: "inspect", teach: "teach", project: "book", apply: "apply" };
    return '<div class="task-list do-task-list">' + list.map(function (a) {
      const st = taskStatus(state, a);
      const costHtml = a.cost
        ? '<em class="cost">费用：' + wan(a.cost) + '</em>'
        : '<em class="cost free">不占本季</em>';
      const tag = st.tag ? '<span class="do-task-tag">' + st.tag + '</span>' : '';
      const trail = st.kind === "done"
        ? '<span class="do-task-trail is-done">' + icon("ok", { size: 18 }) + '<em>本季已完成</em></span>'
        : st.kind === "lock" && a.disabled
          ? '<span class="do-task-trail is-lock">' + icon("shield", { size: 16 }) + '<em>条件未达成</em></span>'
          : '<button type="button" class="campus-task__go task-go" data-act="action" data-arg="' + a.id + '"' +
            (st.disabled ? " disabled" : "") + ">" + st.cta + "</button>";
      return '<article class="campus-task task-card do-task' + (st.disabled ? " is-off off" : "") + '">' +
        '<span class="campus-task__ico ico">' + icon(icons[a.id] || "build", { size: 22 }) + '</span>' +
        '<div class="campus-task__body actxt"><div class="do-task-name"><b>' + esc(a.name) + '</b>' + tag + '</div>' +
        '<small class="do-task-desc">' + esc(a.desc) + '</small>' + costHtml + '</div>' + trail + '</article>';
    }).join("") + '</div>';
  }

  function inquiryGrid(state, list) {
    const icons = { donate: "donate", office: "office", gov: "gov", students: "students" };
    return '<div class="do-inquiry-grid">' + list.map(function (a) {
      const st = taskStatus(state, a);
      return '<article class="do-inquiry-card' + (st.disabled ? " is-off" : "") + '">' +
        '<span class="do-inquiry-card__ico">' + icon(icons[a.id] || "office", { size: 28 }) + '</span>' +
        '<div class="do-inquiry-card__copy"><b>' + esc(a.name) + '</b><small>' + esc(a.desc) + '</small></div>' +
        '<button type="button" class="do-inquiry-card__go" data-act="action" data-arg="' + a.id + '"' +
        (st.disabled ? " disabled" : "") + ">" + (st.disabled ? st.cta : "去处理") + "</button></article>";
    }).join("") + '</div>';
  }

  function doSheet(state) {
    if (state.scene && state.scene.kind === "bulletin") return bulletinSheet(state);
    if (state.scene) {
      const body = decisionHead(state) + glanceLine(state);
      const visual = heroArt("gate") || campusArt(false);
      return (UI
        ? UI.eventCard({ visualHtml: visual, bodyHtml: body })
        : '<section class="event-card"><div class="event-visual">' + visual + '</div><div class="event-body">' + body + '</div></section>') +
        decisionButtons(state);
    }
    const list = actionsCatalog(state);
    const season = list.filter(function (a) { return !a.free; });
    const inquiry = list.filter(function (a) { return a.free; });
    const greet = seasonGreeting(state);
    const grade = scoreGrade(state.score);
    return '<section class="dash-hero do-hero">' +
      '<div class="dash-bg do-hero__bg">' + (heroArt("home") || campusArt(false)) + '</div>' +
      '<div class="dash-fg do-hero__fg">' +
      '<div class="do-hero__top">' +
      '<div class="do-hero__identity">' +
      '<div class="do-hero__avatar">' + (heroArt("principal") || principalAvatarChip()) + '</div>' +
      '<div class="do-hero__brand"><b>' + esc(state.schoolName) + '</b>' +
      '<small>' + icon("cap", { size: 14 }) + '第 ' + state.year + ' 年 · ' + seasonName(state) + '季学期</small></div></div>' +
      '<div class="do-hero__chips">' +
      '<span class="chip is-score">' + icon("star", { tone: "gold", size: 14 }) + state.score + ' · ' + grade + '</span>' +
      '<span class="chip funds is-funds">' + icon("coin", { size: 14 }) + wan(state.funds) + '</span></div></div>' +
      '<div class="do-hero__greet"><h1>' + esc(greet.title) + '</h1><p>' + esc(greet.body) + '</p></div>' +
      '</div></section>' +
      yearEventsList(state) +
      doPaneTabs() +
      doPaneBody(state, season, inquiry);
  }

  function tierLabel(state) {
    if (state.tier <= 0) return "大专";
    if (state.track === "vocational") return "职业本科";
    return TIERS[state.tier].name;
  }

  function trackLabel(state) {
    if (state.track === "vocational") return "职业本科";
    if (state.track === "academic") return "普通本科";
    return "还没选";
  }

  function campusBuildingGrid(state) {
    const owned = BUILDINGS.filter(function (b) { return buildingCount(state, b.id) > 0; });
    if (!owned.length) return "";
    return '<div class="campus-grid">' + owned.map(function (b) {
      const src = Assets.buildingSrc ? Assets.buildingSrc(b.id) : null;
      const count = buildingCount(state, b.id);
      const art = src ? artImg(src, "art-building", b.name) : '<span class="art-fallback">' + icon("build") + "</span>";
      if (UI) return UI.buildingCard({ name: b.name, meta: "×" + count, artHtml: art });
      return '<figure class="campus-item">' + art +
        "<figcaption><b>" + esc(b.name) + "</b><em>×" + count + "</em></figcaption></figure>";
    }).join("") + "</div>";
  }

  function schoolTabs() {
    const panes = [["overview", "概况"], ["build", "建设"], ["depts", "学科"]];
    return '<div class="seg-tabs school-tabs" role="tablist">' + panes.map(function (p) {
      const on = schoolPane === p[0];
      return '<button type="button" role="tab" class="' + (on ? "on is-on" : "") +
        '" data-act="school-pane" data-arg="' + p[0] + '"' + (on ? ' aria-selected="true"' : "") + '>' +
        p[1] + '</button>';
    }).join("") + '</div>';
  }

  function deptChips(state) {
    const tones = ["tone-sky", "tone-orange", "tone-blue", "tone-green", "tone-purple", "tone-teal"];
    return '<div class="dept-chips school-dept-chips">' + state.depts.map(function (d, i) {
      const meta = DEPTS.find(function (x) { return x.id === d.id; });
      return '<span class="dept-chip ' + (tones[i] || "") + '"><b>' + meta.name + '</b><em>' + d.strength + '</em></span>';
    }).join("") + '</div>';
  }

  function schoolOverviewPane(state) {
    const campus = campusOf(state);
    const band = worldBand(rankScore(state));
    const points = (state.masterPoints || []).map(deptName);
    const staff = state.teachers ? state.teachers.length : 0;
    const facts = [
      ["students", "在校生", String(campus.students)],
      ["campus", "容量", String(capacityOf(state))],
      ["teachers", "教职工", String(staff)],
      ["growth", "路线", trackLabel(state)],
      ["home", "来路", originName(state.origin)],
      ["education", "专业硕士点", points.length ? points.join("、") : "无"],
      ["cap", "办学层次", tierLabel(state)],
      ["world", "寰球榜", band.label],
      ["build", "占地", campus.mu + " 亩"],
      ["mail", "省里的文", policyName(state)]
    ];
    return '<div class="school-ladder">' + ladderHtml(state) + '</div>' +
      '<section class="campus-card card soft school-overview">' +
      '<div class="school-overview__head">' + icon("reward", { size: 18 }) +
      '<h2>学校概况</h2><span class="school-overview__link">综合实力 ›</span></div>' +
      powerBlock(state) +
      '<div class="school-facts">' + facts.map(function (f) {
        return '<div class="school-fact"><span class="school-fact__ico">' + icon(f[0], { size: 16 }) +
          '</span><div><em>' + f[1] + '</em><b>' + esc(f[2]) + '</b></div></div>';
      }).join("") + '</div>' +
      deptChips(state) + '</section>';
  }

  function schoolBuildPane(state) {
    const campus = campusOf(state);
    const pending = campus.pending ? buildingById(campus.pending) : null;
    const built = BUILDINGS.filter(function (b) { return buildingCount(state, b.id) > 0; })
      .map(function (b) { return b.name + " ×" + buildingCount(state, b.id); });
    return '<section class="campus-card card soft school-section">' +
      '<div class="card-head school-section__head"><h2>校园建设</h2><span class="meta">' +
      (pending ? ("在建：" + esc(pending.name)) : "暂无在建") + '</span></div>' +
      campusBuildingGrid(state) +
      '<p class="meta school-section__note">' +
      (built.length ? esc(built.join(" · ")) : "教学楼和宿舍各有一座。") + '</p></section>';
  }

  function schoolDeptsPane(state) {
    return '<section class="campus-card card soft school-section">' +
      '<div class="card-head school-section__head"><h2>六个系</h2></div>' +
      '<div class="depts school-depts">' +
      state.depts.map(function (d, i) {
        return '<div class="school-dept tone-' + (i % 6) + '">' + deptHtml(state, d, true) + '</div>';
      }).join("") + '</div></section>';
  }

  function schoolSheet(state) {
    const review = state.year % 2 === 0 ? " · 年终评审" : "";
    let body = schoolOverviewPane(state);
    if (schoolPane === "build") body = schoolBuildPane(state);
    if (schoolPane === "depts") body = schoolDeptsPane(state);
    return pendingBanner(state) +
      '<section class="school-hero">' +
      '<div class="school-hero-art">' + (heroArt("home") || campusArt(true)) + '</div>' +
      '<div class="school-hero-copy">' +
      '<span class="school-hero__badge">' + tierLabel(state) + review + '</span>' +
      '<h2>' + esc(state.schoolName) + '</h2>' +
      '<p class="meta">第 ' + state.year + ' 年 · ' + seasonName(state) +
      (state.lastJobs ? ' · 去年就业：' + esc(state.lastJobs) : '') + '</p></div></section>' +
      schoolTabs() +
      '<div class="school-panel">' + body + '</div>';
  }

  function peopleSheet(state) {
    if (peopleDetailId) {
      const detail = teacherDetailSheet(state, peopleDetailId);
      if (detail) return pendingBanner(state) + detail;
      peopleDetailId = null;
    }
    return pendingBanner(state) +
      peopleSchoolBar(state) +
      '<div class="people-panel">' +
      peoplePaneTabs() +
      peoplePaneBody(state) +
      '</div>';
  }

  function peopleSchoolBar(state) {
    return '<section class="people-head">' +
      '<div class="people-head__sky" aria-hidden="true">' + (heroArt("home") || campusArt(true)) + '</div>' +
      '<div class="people-head__top">' +
      '<div class="people-head__identity">' +
      principalAvatarChip() +
      '<div class="people-head__copy"><b>' + esc(state.schoolName) + '</b>' +
      '<small>第 ' + state.year + ' 年 · ' + seasonName(state) + '学期 · ' + tierLabel(state) + '</small>' +
      '<p class="people-head__motto">优秀教师是学校发展的基石</p></div></div>' +
      peopleResourceChips(state) +
      '</div></section>';
  }

  function peoplePaneTabs() {
    const panes = [
      ["overview", "教师", "teachers"],
      ["hire", "招聘", "search"],
      ["train", "培养", "education"],
      ["assess", "考核", "assess"]
    ];
    return '<div class="people-icon-tabs people-pane-tabs" role="tablist">' + panes.map(function (p) {
      const on = peoplePane === p[0];
      return '<button type="button" role="tab" class="people-icon-tab' + (on ? " is-on on" : "") +
        '" data-act="people-pane" data-arg="' + p[0] + '"' + (on ? ' aria-selected="true"' : "") + '>' +
        '<span class="people-icon-tab__ico">' + icon(p[2], { size: 22 }) + '</span><span>' + p[1] + '</span></button>';
    }).join("") + '</div>';
  }

  function peoplePaneBody(state) {
    if (peoplePane === "hire") return peopleHirePane(state);
    if (peoplePane === "train") return peopleTrainPane(state);
    if (peoplePane === "assess") return peopleAssessPane(state);
    return peopleOverviewPane(state);
  }

  function peopleTeamMetrics(state) {
    const list = state.teachers || [];
    const total = list.length;
    const chairs = list.filter(function (t) { return isChair(state, t); }).length;
    const duals = list.filter(isDual).length;
    const stars = list.filter(function (t) { return (t.talent || 0) >= 70; }).length;
    const senior = list.filter(function (t) { return (t.rank || 0) >= 2; }).length;
    const phd = list.filter(function (t) { return t.degree === "博士"; }).length;
    const avgTalent = total ? Math.round(list.reduce(function (s, t) { return s + (t.talent || 0); }, 0) / total) : 0;
    const avgLoyalty = total ? Math.round(list.reduce(function (s, t) { return s + (t.loyalty || 0); }, 0) / total) : 0;
    const leverage = list.filter(function (t) { return t.leverage; }).length;
    const weak = list.filter(function (t) { return (t.talent || 0) < 45; }).length;
    const ranks = [0, 0, 0, 0];
    list.forEach(function (t) { ranks[t.rank] = (ranks[t.rank] || 0) + 1; });
    return {
      total: total,
      chairs: chairs,
      duals: duals,
      stars: stars,
      senior: senior,
      phd: phd,
      avgTalent: avgTalent,
      avgLoyalty: avgLoyalty,
      leverage: leverage,
      weak: weak,
      ranks: ranks
    };
  }

  function peopleDonut(m) {
    const colors = ["#f5c9d0", "#f2ae65", "#80c6a5", "#6398df"];
    const r = 34;
    const c = 2 * Math.PI * r;
    let offset = 0;
    const segs = [];
    for (let i = 3; i >= 0; i--) {
      const n = m.ranks[i] || 0;
      const len = m.total ? (n / m.total) * c : 0;
      segs.push('<circle class="people-donut__seg" cx="48" cy="48" r="' + r +
        '" fill="none" stroke="' + colors[i] + '" stroke-width="12" stroke-dasharray="' +
        len.toFixed(2) + " " + c.toFixed(2) + '" stroke-dashoffset="' + (-offset).toFixed(2) +
        '" transform="rotate(-90 48 48)"/>');
      offset += len;
    }
    return '<div class="people-donut">' +
      '<svg viewBox="0 0 96 96" aria-hidden="true">' + segs.join("") +
      '<circle cx="48" cy="48" r="24" fill="#fffdf8"/></svg>' +
      '<div class="people-donut__center"><span>总人数</span><b>' + m.total + '</b></div></div>';
  }

  function peopleStatsCard(state) {
    const m = peopleTeamMetrics(state);
    const cells = [
      [icon("teachers", { size: 18 }), "专任教师", m.total + " 人", "tone-blue"],
      [icon("education", { size: 18 }), "高级职称", m.senior + " 人", "tone-sky"],
      [icon("education", { size: 18 }), "博士学历", m.phd + " 人", "tone-warm"],
      [icon("star", { tone: "gold", size: 18 }), "平均忠诚", String(m.avgLoyalty), "tone-pink"]
    ];
    return '<section class="campus-card people-stats-card">' +
      '<div class="campus-card__head"><h2>教师总览</h2>' +
      '<button type="button" class="people-linkish" data-act="filter-toggle">共 ' + m.total + ' 人 ' +
      icon("go", { size: 16 }) + "</button></div>" +
      '<div class="people-stats-grid people-stats-grid--ref">' + cells.map(function (cell) {
        return '<div class="people-mini-stat ' + cell[3] + '"><span class="people-mini-stat__ico">' + cell[0] +
          '</span><em>' + cell[1] + '</em><b>' + cell[2] + '</b></div>';
      }).join("") + '</div></section>';
  }

  function peopleStructureCard(state) {
    const m = peopleTeamMetrics(state);
    const order = [3, 2, 1, 0];
    const colors = ["#f5c9d0", "#f2ae65", "#80c6a5", "#6398df"];
    const legend = '<ul class="people-rank-legend">' + order.map(function (i) {
      const n = m.ranks[i] || 0;
      const pct = m.total ? ((n / m.total) * 100).toFixed(1) : "0.0";
      return '<li><i style="background:' + colors[i] + '"></i><b>' + RANKS[i] + '</b>' +
        '<span>' + n + ' 人</span><em>' + pct + '%</em></li>';
    }).join("") + '</ul>';
    return '<section class="campus-card people-structure-card">' +
      '<div class="campus-card__head"><h2>教师队伍结构</h2><span class="meta">职称占比</span></div>' +
      '<div class="people-structure-body">' +
      peopleDonut(m) +
      legend +
      '<div class="people-structure-art">' + (heroArt("home") || campusArt(true)) + '</div>' +
      '</div></section>';
  }

  function peopleRosterCard(state) {
    const showFilters = peopleFilterOpen || peopleFilter !== "all";
    return '<section class="campus-card people people-list">' +
      '<div class="campus-card__head"><h2>教师列表</h2>' +
      '<button type="button" class="people-filter-btn" data-act="filter-toggle">' + icon("filter", { size: 16 }) +
      " 筛选</button></div>" +
      (showFilters ? rankFilters() : "") +
      facultyHtml(state) + "</section>";
  }

  function peopleOverviewPane(state) {
    return peopleStatsCard(state) +
      peopleStructureCard(state) +
      peopleRosterCard(state);
  }

  function peopleHirePane(state) {
    const canHire = !state.scene && state.actionsLeft > 0 && state.funds >= 14;
    const hireBtn = UI
      ? UI.button({
        variant: "primary",
        label: "开始招聘",
        cost: wan(14),
        disabled: !canHire,
        attrs: { "data-act": "action", "data-arg": "recruit" }
      })
      : '<button class="primary" data-act="action" data-arg="recruit"' + (canHire ? "" : " disabled") + '>开始招聘<em>' + wan(14) + '</em></button>';
    return '<section class="campus-card campus-card--soft people-hire-pane">' +
      '<div class="campus-card__head"><h2>人才招聘</h2><span class="meta">现有规则</span></div>' +
      '<p class="lede">' + esc(recruitOddsLine(state.tier)) + '</p>' +
      '<p class="meta">花费 ' + wan(14) + '，占用本季一次行动。先选系，再引进。出身和擅长会拉动对应指标；贪的人可能带来把柄风险。</p>' +
      hireBtn + '</section>' +
      peopleRosterCard(state);
  }

  function peopleTrainPane(state) {
    const teachSpec = actionsCatalog(state).find(function (a) { return a.id === "teach"; });
    const canTeach = teachSpec && !(teachSpec.disabled || (teachSpec.once && state.used.teach) || state.funds < teachSpec.cost || state.actionsLeft <= 0);
    const focus = teachFocus(state);
    const weak = (state.teachers || []).slice().sort(function (a, b) { return (a.talent || 0) - (b.talent || 0); }).slice(0, 4);
    const chairs = (state.teachers || []).filter(function (t) { return isChair(state, t); });
    const list = weak.length
      ? '<div class="people-train-list">' + weak.map(function (t) {
        const meta = DEPTS.find(function (x) { return x.id === t.dept; });
        return '<div class="people-train-row"><b>' + esc(t.name) + '</b><span>' + (meta ? meta.name : "") +
          ' · 才华 ' + t.talent + ' · ' + RANKS[t.rank] + '</span></div>';
      }).join("") + '</div>'
      : '<p class="meta">名册还是空的。</p>';
    const chairLine = chairs.length
      ? chairs.map(function (t) { return esc(t.name); }).join("、")
      : "还没有学科带头人";
    return '<section class="campus-card people-train-pane">' +
      '<div class="campus-card__head"><h2>教师培养</h2><span class="meta">沿用教学评估</span></div>' +
      '<p class="lede">没有单独的一对一培养指令。现有培养操作是「教学评估」：花费 ' + wan(6) + '，一年一次，补' +
      esc(focus.label || "教学") + '。</p>' +
      '<p class="meta">职称晋升仍在双年评审里处理，不在这里另开规则。</p>' +
      (UI
        ? UI.button({ variant: "primary", label: "去做教学评估", cost: wan(6), disabled: !canTeach, attrs: { "data-act": "action", "data-arg": "teach" } })
        : '<button class="primary" data-act="action" data-arg="teach"' + (canTeach ? "" : " disabled") + '>去做教学评估<em>' + wan(6) + '</em></button>') +
      '</section>' +
      '<section class="campus-card"><div class="campus-card__head"><h2>优先关注</h2><span class="meta">才华偏低</span></div>' + list +
      '<p class="meta">当前带头人：' + chairLine + '</p></section>' +
      peopleRosterCard(state);
  }

  function peopleAssessPane(state) {
    const m = peopleTeamMetrics(state);
    const list = state.teachers || [];
    const bands = [
      ["成果够", list.filter(function (t) { return (t.talent || 0) >= 62; }).length],
      ["成果勉强", list.filter(function (t) { return (t.talent || 0) >= 45 && (t.talent || 0) < 62; }).length],
      ["成果不够", list.filter(function (t) { return (t.talent || 0) < 45; }).length]
    ];
    const risk = list.filter(function (t) { return t.leverage || t.skimming || (t.loyalty || 0) <= 40; });
    const bandHtml = '<div class="people-assess-bands">' + bands.map(function (b) {
      return '<div class="people-assess-band"><b>' + b[1] + '</b><span>' + b[0] + '</span></div>';
    }).join("") + '</div>';
    const riskHtml = risk.length
      ? '<ul class="log people-assess-log">' + risk.map(function (t) {
        const meta = DEPTS.find(function (x) { return x.id === t.dept; });
        return '<li><button type="button" class="people-assess-link" data-act="teacher" data-arg="' + esc(t.id) + '">' +
          esc(t.name) + '</button> · ' + (meta ? meta.name : "") + ' · ' + esc(dossier(t)) +
          ' · 忠诚 ' + t.loyalty + '</li>';
      }).join("") + '</ul>'
      : '<p class="meta">这一档没有明显考核风险。</p>';
    return '<section class="campus-card people-assess-pane">' +
      '<div class="campus-card__head"><h2>教师考核</h2><span class="meta">按现有档案</span></div>' +
      '<div class="people-growth">' +
      '<div><span>平均才华</span><b>' + m.avgTalent + '</b></div>' +
      '<div><span>平均忠诚</span><b>' + m.avgLoyalty + '</b></div>' +
      '<div><span>骨干</span><b>' + m.stars + '</b></div>' +
      '<div><span>风险人数</span><b>' + risk.length + '</b></div></div>' +
      bandHtml +
      '<p class="meta">档位沿用评审里的成果标准（才华 62 / 45）。</p></section>' +
      '<section class="campus-card"><div class="campus-card__head"><h2>需要盯住的人</h2><span class="meta">把柄 / 账洞 / 低忠诚</span></div>' +
      riskHtml + '</section>' +
      peopleRosterCard(state);
  }

  function filteredTeacherCount(state) {
    if (!state.teachers) return 0;
    return state.teachers.filter(function (t) {
      return peopleFilter === "all" || String(t.rank) === peopleFilter;
    }).length;
  }

  function rankFilters() {
    const ranks = [["all", "全部"], ["3", "教授"], ["2", "副教授"], ["1", "讲师"], ["0", "助教"]];
    if (UI) {
      return UI.tabs({
        act: "filter",
        active: peopleFilter,
        items: ranks.map(function (r) { return { id: r[0], label: r[1] }; })
      }).replace('class="campus-tabs seg-tabs"', 'class="campus-tabs seg-tabs people-filters"');
    }
    return '<div class="filters people-filters">' + ranks.map(function (r) {
      return '<button type="button" data-act="filter" data-arg="' + r[0] + '"' +
        (peopleFilter === r[0] ? ' class="on"' : '') + '>' + r[1] + '</button>';
    }).join("") + '</div>';
  }

  function gateBlock(title, meta, items) {
    return '<section class="card"><h2>' + esc(title) + '</h2>' +
      (meta ? '<p class="meta">' + esc(meta) + '</p>' : '') +
      '<ul class="gates">' + items.map(gateHtml).join("") + '</ul></section>';
  }

  function applyStepper(readyCount, total) {
    const ratio = total ? readyCount / total : 0;
    const step = ratio >= 1 ? 2 : ratio >= 0.5 ? 1 : 0;
    const labels = ["条件准备", "提交申报", "等待结果"];
    return '<ol class="stepper">' + labels.map(function (label, i) {
      const cls = i < step ? "done" : i === step ? "on" : "";
      return '<li class="' + cls + '"><span>' + (i + 1) + '</span><em>' + label + '</em></li>';
    }).join("") + '</ol>';
  }

  function projectCard(title, meta, items, cta) {
    const ok = items.filter(function (it) { return it.ok; }).length;
    return '<section class="project-card">' +
      '<div class="project-top"><div><h2>' + esc(title) + '</h2><p class="meta">' + esc(meta) + '</p></div>' +
      '<span class="project-count">' + ok + '/' + items.length + '</span></div>' +
      applyStepper(ok, items.length) +
      '<ul class="gates compact">' + items.map(gateHtml).join("") + '</ul>' +
      (cta || "") + '</section>';
  }

  function applyButton(state, label, cost) {
    const used = !!state.used.apply;
    const blocked = state.applyBlockYear === state.year;
    if (UI) {
      return UI.button({
        variant: "accent",
        label: label,
        cost: cost ? wan(cost) : "",
        disabled: used || blocked,
        className: "apply-cta",
        attrs: { "data-act": "action", "data-arg": "apply" }
      });
    }
    return '<button class="accent apply-cta" data-act="action" data-arg="apply"' + (used || blocked ? " disabled" : "") + '>' +
      esc(label) + (cost ? '<em>' + wan(cost) + '</em>' : '') + '</button>';
  }

  function applyHero(eyebrow, title, meta) {
    return '<section class="apply-hero">' +
      '<div class="apply-hero__bg">' + (heroArt("apply") || campusArt(true)) + '</div>' +
      '<div class="apply-hero-copy"><p class="eyebrow">' + esc(eyebrow) + '</p><h2>' + esc(title) + '</h2>' +
      '<p class="meta">' + esc(meta) + '</p></div></section>';
  }

  function applyPathCard(title, tone, items, costHint) {
    const ok = items.filter(function (it) { return it.ok; }).length;
    const total = items.length;
    const pct = total ? Math.round((ok / total) * 100) : 0;
    return '<article class="apply-path apply-path--' + tone + '">' +
      '<span class="apply-path__ico">' + icon("education", { size: 28 }) + '</span>' +
      '<h3>' + esc(title) + '</h3>' +
      '<b class="apply-path__count">' + ok + ' <em>/ ' + total + '</em></b>' +
      '<div class="apply-path__bar"><i style="width:' + pct + '%"></i></div>' +
      '<p class="apply-path__hint">' + esc(costHint) + '</p>' +
      '<button type="button" class="apply-path__go" data-act="apply-filter" data-arg="open">条件准备 ›</button>' +
      '</article>';
  }

  function applyCompareGroups(academicItems, vocationalItems) {
    const defs = [
      { id: "power", name: "综合实力", icon: "reward", re: /综合评分|报考热度|四个系|最短的系|理学|工学或计算机/ },
      { id: "staff", name: "教学师资", icon: "teachers", re: /教学|硕博|双师/ },
      { id: "funds", name: "资金保障", icon: "coin", re: /经费|贷款/ },
      { id: "campus", name: "校园建设", icon: "build", re: /占地|教学楼|实验楼|图书馆|宿舍|实训楼|产教基地/ },
      { id: "gov", name: "学校治理", icon: "shield", re: /风纪|把柄|举报/ }
    ];
    function pick(items, re) {
      return items.filter(function (it) { return re.test(it.label); });
    }
    function statusOf(aList, vList) {
      const aOk = aList.filter(function (it) { return it.ok; }).length;
      const vOk = vList.filter(function (it) { return it.ok; }).length;
      const aTotal = aList.length;
      const vTotal = vList.length;
      if (aTotal + vTotal === 0) return { kind: "lock", label: "未达成" };
      if (aOk === aTotal && vOk === vTotal) return { kind: "done", label: "已达成" };
      if (aOk === 0 && vOk === 0) return { kind: "lock", label: "未达成" };
      const ratio = (aOk + vOk) / (aTotal + vTotal);
      if (ratio >= 0.45) return { kind: "progress", label: "进行中" };
      return { kind: "warn", label: "待提升" };
    }
    return defs.map(function (def) {
      const aList = pick(academicItems, def.re);
      const vList = pick(vocationalItems, def.re);
      const aOk = aList.filter(function (it) { return it.ok; }).length;
      const vOk = vList.filter(function (it) { return it.ok; }).length;
      return {
        id: def.id,
        name: def.name,
        icon: def.icon,
        aList: aList,
        vList: vList,
        aShown: aOk + "/" + aList.length,
        vShown: vOk + "/" + vList.length,
        status: statusOf(aList, vList)
      };
    }).filter(function (g) { return g.aList.length || g.vList.length; });
  }

  function applyCompareSection(academic, vocational) {
    const groups = applyCompareGroups(academic.items, vocational.items);
    const filtered = groups.filter(function (g) {
      if (applyGateFilter === "done") return g.status.kind === "done";
      if (applyGateFilter === "open") return g.status.kind !== "done";
      return true;
    });
    const filters = [["all", "全部"], ["open", "未达成"], ["done", "已达成"]];
    return '<section class="campus-card card soft apply-compare">' +
      '<div class="apply-compare__head">' + icon("star", { tone: "gold", size: 18 }) +
      '<h2>申报条件对比</h2></div>' +
      '<div class="apply-compare__filters" role="tablist">' + filters.map(function (f) {
        const on = applyGateFilter === f[0];
        return '<button type="button" role="tab" class="' + (on ? "is-on on" : "") +
          '" data-act="apply-filter" data-arg="' + f[0] + '"' + (on ? ' aria-selected="true"' : "") + '>' +
          f[1] + '</button>';
      }).join("") + '</div>' +
      '<div class="apply-compare__list">' + filtered.map(function (g) {
        const open = applyExpandId === g.id;
        return '<article class="apply-row' + (open ? " is-open" : "") + '">' +
          '<button type="button" class="apply-row__main" data-act="apply-expand" data-arg="' + g.id + '">' +
          '<span class="apply-row__ico">' + icon(g.icon, { size: 22 }) + '</span>' +
          '<div class="apply-row__copy"><b>' + esc(g.name) + '</b>' +
          '<small>普通 ' + g.aShown + ' · 职业 ' + g.vShown + '</small></div>' +
          '<span class="apply-row__tag is-' + g.status.kind + '">' + g.status.label + '</span>' +
          '<span class="apply-row__chev" aria-hidden="true">' + (open ? "˄" : "˅") + '</span></button>' +
          (open
            ? '<div class="apply-row__detail">' +
              '<div class="apply-row__col"><em>普通本科</em><ul>' + g.aList.map(function (it) {
                return '<li class="' + (it.ok ? "ok" : "no") + '">' + esc(it.label) + '<span>' + esc(it.shown) + '</span></li>';
              }).join("") + '</ul></div>' +
              '<div class="apply-row__col"><em>职业本科</em><ul>' + g.vList.map(function (it) {
                return '<li class="' + (it.ok ? "ok" : "no") + '">' + esc(it.label) + '<span>' + esc(it.shown) + '</span></li>';
              }).join("") + '</ul></div></div>'
            : "") +
          '</article>';
      }).join("") + '</div></section>';
  }

  function applySheet(state) {
    if (state.tier <= 0) {
      const academic = pathGates(state, "academic");
      const vocational = pathGates(state, "vocational");
      return pendingBanner(state) +
        applyHero("当前可申报 · 2项", "升本项目", "提升办学层次，建设更高水平大学！") +
        '<div class="apply-paths">' +
        applyPathCard("普通本科", "blue", academic.items, "经费 " + wan(academic.cost) + " · 可续冲 212") +
        applyPathCard("职业本科", "orange", vocational.items, "经费 " + wan(vocational.cost) + " · 升完封顶") +
        '</div>' +
        applyCompareSection(academic, vocational) +
        applyButton(state, "选择升本路线", 0);
    }
    if (state.track === "vocational") {
      const full = state.masterPoints.length >= 2;
      const cards = MASTER_DEPTS.map(function (id) {
        if (state.masterPoints.indexOf(id) >= 0) {
          return '<section class="project-card done"><div class="project-top"><div><h2>' + esc(deptName(id)) + '专业硕士点</h2><p class="meta">已经拿到。</p></div><span class="project-count">完成</span></div></section>';
        }
        const g = masterGates(state, id);
        return projectCard(g.title, "经费 " + wan(g.cost) + "。职业本科办满三年才能递。", g.items);
      }).join("");
      return pendingBanner(state) +
        applyHero("当前可申报", "专业硕士点", "职业本科封顶路径。最多两个点。") +
        cards +
        (full ? '<p class="ready">两个点都在。</p>' : applyButton(state, "申报专业硕士点", 0));
    }
    const g = gates(state);
    if (!g) {
      return pendingBanner(state) +
        applyHero("申报中心", "D9", "已经进了 D9。剩下的是榜单，还有把柄会不会炸。");
    }
    const prize = tierPrize(state.tier + 1);
    const ready = g.items.every(function (it) { return it.ok; });
    const missing = g.items.filter(function (it) { return !it.ok; }).length;
    const used = !!state.used.apply;
    const short = state.funds < g.cost;
    const disabled = used || short;
    let tip = '<p class="ready">已满足全部条件。过了：' + esc(prize.lines.join("，")) + '。</p>';
    if (!ready) tip = '<p class="ready gap">还有 ' + missing + ' 项没到。</p>';
    if (short) tip = '<p class="ready gap">经费不够，现在递不出去。</p>';
    if (used) tip = '<p class="ready gap">今年已经申报过了。</p>';
    return pendingBanner(state) +
      applyHero("当前可申报", g.title, "过了：" + prize.lines.join("，") + "。省里按这一档送评。") +
      projectCard(g.title, "经费 " + wan(g.cost) + "。把柄不动。", g.items,
        tip + '<button class="accent apply-cta" data-act="action" data-arg="apply"' + (disabled ? " disabled" : "") + '>申请' + esc(g.title) + '<em>' + wan(g.cost) + '</em></button>');
  }

  function ladderHtml(state) {
    if (state.track === "vocational") {
      const rungs = [["01", "大专", "done"], ["02", "职业本科", "on"], ["不收", "212", "lock"], ["不收", "986", "lock"], ["不收", "D9", "lock"]];
      return '<div class="ladder">' + rungs.map(function (r) {
        return '<div class="rung ' + r[2] + '"><small>' + r[0] + '</small><b>' + r[1] + '</b></div>';
      }).join("") + '</div>';
    }
    return '<div class="ladder">' + TIERS.map((t, i) => {
      const cls = i === state.tier ? "on" : i < state.tier ? "done" : "";
      return '<div class="rung ' + cls + '"><small>0' + (i + 1) + '</small><b>' + t.name + '</b></div>';
    }).join("") + '</div>';
  }

  function deptTone(n) {
    if (n < 18) return "bad";
    if (n < 32) return "near";
    return "";
  }

  function deptHtml(state, d, slim) {
    const meta = DEPTS.find((x) => x.id === d.id);
    const tone = deptTone(d.strength);
    if (UI) {
      return '<div class="dept">' +
        UI.progress({ label: meta.name, shown: String(d.strength), pct: d.strength, toneClass: tone }) +
        (slim ? "" : '<div class="hint">' + meta.role + "</div>") + "</div>";
    }
    return '<div class="dept"><div class="row"><b>' + meta.name + '</b><span>' + d.strength + '</span></div>' +
      '<div class="track"><i class="' + tone + '" style="width:' + d.strength + '%"></i></div>' +
      (slim ? '' : '<div class="hint">' + meta.role + '</div>') + '</div>';
  }

  function gateHtml(it) {
    const ratio = it.need ? it.value / it.need : 0;
    let pct = Math.max(0, Math.min(100, ratio * 100));
    let tone = "";
    if (it.below) {
      pct = it.ok ? Math.max(12, Math.min(100, (1 - ratio) * 100)) : 100;
      tone = it.ok ? "ok" : "bad";
    } else if (it.ok) tone = "ok";
    else if (ratio >= 0.8) tone = "near";
    else if (ratio < 0.45) tone = "bad";
    if (UI) {
      return '<li class="req">' +
        UI.progress({
          label: it.label,
          shown: it.shown + (it.ok ? " ✓" : ""),
          pct: pct,
          toneClass: tone
        }) + "</li>";
    }
    return '<li class="req"><div class="row"><b>' + it.label + '</b><span class="' + (it.ok ? "ok" : "no") + '">' + it.shown + '</span>' +
      (it.ok ? '<i class="tick">✓</i>' : '') + '</div>' +
      '<div class="track"><i class="' + tone + '" style="width:' + pct.toFixed(1) + '%"></i></div></li>';
  }

  function backgroundText(teacher) {
    if (!teacher.school) {
      teacher.pedigree = 0;
      teacher.school = "本校";
      teacher.degree = "本科";
      teacher.skill = "research";
    }
    return teacher.school + " · " + teacher.degree + " · 擅长" + skillById(teacher.skill).name;
  }

  function teacherAvatarInner(t) {
    const src = Assets.teacherSrc ? Assets.teacherSrc(t) : null;
    if (src) return artImg(src, "art-character", t.name);
    return esc(t.name.slice(0, 1));
  }

  function teacherAvatar(t) {
    return '<span class="avatar sprite">' + teacherAvatarInner(t) + "</span>";
  }

  function teacherBadges(state, t) {
    return '<span class="tag rank campus-badge">' + RANKS[t.rank] + '</span>' +
      (t.leverage ? '<span class="tag warn campus-badge campus-badge--warn">把柄</span>' : '') +
      (isChair(state, t) ? '<span class="tag campus-badge">学科带头人</span>' : '') +
      (t.skimming ? '<span class="tag warn campus-badge campus-badge--warn">账上有洞</span>' : '') +
      (isDual(t) ? '<span class="tag campus-badge campus-badge--gold">双师</span>' : '');
  }

  function teacherStatBars(t) {
    if (UI) {
      return '<div class="teacher-bars">' +
        UI.progress({ label: "才华", shown: String(t.talent), pct: t.talent, toneClass: t.talent >= 70 ? "ok" : t.talent < 40 ? "near" : "" }) +
        UI.progress({ label: "忠诚", shown: String(t.loyalty), pct: t.loyalty, toneClass: t.loyalty >= 70 ? "ok" : t.loyalty < 40 ? "near" : "" }) +
        '</div>';
    }
    return '<div class="person-scores"><span><em>才华</em><b>' + t.talent + '</b></span><span><em>忠诚</em><b>' + t.loyalty + '</b></span></div>';
  }

  function teacherCard(state, meta, t) {
    const badges = teacherBadges(state, t);
    const metaLine = meta.name + " · 才华 " + t.talent + " · 忠诚 " + t.loyalty;
    const trail = '<span class="teacher-status">在职</span><span class="campus-teacher__go" aria-hidden="true">' +
      icon("go", { size: 16 }) + "</span>";
    if (UI) {
      return UI.teacherCard({
        name: t.name,
        avatarHtml: teacherAvatarInner(t),
        badgesHtml: badges,
        meta: metaLine,
        trailHtml: trail,
        clickable: true,
        attrs: { "data-act": "teacher", "data-arg": t.id }
      });
    }
    return '<button type="button" class="person campus-teacher is-clickable" data-act="teacher" data-arg="' + esc(t.id) + '">' +
      teacherAvatar(t) +
      '<div class="who campus-teacher__who"><div class="nameline campus-teacher__name"><b>' + esc(t.name) + '</b>' +
      badges +
      '</div><div class="meta campus-teacher__meta">' + esc(metaLine) + '</div>' +
      '</div>' + trail + '</button>';
  }

  function findTeacher(state, id) {
    return (state.teachers || []).find(function (t) { return t.id === id; }) || null;
  }

  function teacherDetailSheet(state, id) {
    const t = findTeacher(state, id);
    if (!t) return "";
    const meta = DEPTS.find(function (x) { return x.id === t.dept; }) || { name: "—" };
    const skill = skillById(t.skill);
    const bars = '<div class="teacher-detail-bars">' +
      (UI
        ? UI.progress({ label: "才华", shown: String(t.talent), pct: t.talent, toneClass: t.talent >= 70 ? "ok" : "" }) +
          UI.progress({ label: "忠诚", shown: String(t.loyalty), pct: t.loyalty, toneClass: t.loyalty >= 70 ? "ok" : "" })
        : teacherStatBars(t)) +
      '</div>';
    const facts = '<div class="teacher-facts">' +
      '<div><span>所属系</span><b>' + esc(meta.name) + '</b></div>' +
      '<div><span>职称</span><b>' + RANKS[t.rank] + '</b></div>' +
      '<div><span>学历出身</span><b>' + esc(t.school || "本校") + ' · ' + esc(t.degree || "本科") + '</b></div>' +
      '<div><span>擅长</span><b>' + esc(skill ? skill.name : "科研") + '</b></div>' +
      '</div>';
    return '<section class="campus-card teacher-detail">' +
      '<button type="button" class="teacher-detail-back" data-act="teacher-back">‹ 返回名册</button>' +
      '<div class="teacher-detail-hero">' +
      '<span class="avatar teacher-detail-avatar">' + teacherAvatarInner(t) + '</span>' +
      '<div><p class="eyebrow">' + esc(meta.name) + ' · ' + RANKS[t.rank] + '</p>' +
      '<h2>' + esc(t.name) + '</h2>' +
      '<div class="teacher-detail-badges">' + teacherBadges(state, t) + '</div></div></div>' +
      facts + bars +
      '<p class="meta teacher-detail-note">出身与擅长会影响学校；把柄和账上的洞会在评审与巡察里露出来。培养走教学评估，晋升在双年评审里处理。</p>' +
      '</section>';
  }

  function facultyHtml(state) {
    const cards = [];
    DEPTS.forEach(function (meta) {
      const people = deptTeachers(state, meta.id).filter(function (t) {
        return peopleFilter === "all" || String(t.rank) === peopleFilter;
      });
      if (!people.length) {
        if (peopleFilter === "all") {
          cards.push('<div class="person empty campus-teacher is-empty"><span class="avatar sprite">' +
            (Assets.characters && Assets.characters["staff-female"]
              ? artImg(Assets.characters["staff-female"], "art-character", "空缺")
              : icon("teachers", { size: 18 })) +
            '</span><div><b>' + meta.name + '</b><div class="meta">没有带头人，年底这个系会往下掉。</div></div></div>');
        }
        return;
      }
      people.forEach(function (t) { cards.push(teacherCard(state, meta, t)); });
    });
    if (!cards.length) return '<p class="meta people-empty">这一档现在没有人。</p>';
    return cards.join("");
  }

  function decisionHead(state) {
    if (!state.scene) return "";
    return '<p class="eyebrow">要你拍板</p><h1>' + esc(state.scene.title) + '</h1>' +
      '<p class="lede">' + esc(state.scene.body) + '</p>' +
      (state.scene.lines ? '<div class="reason"><b>这一年动过的数</b><ul class="log">' + state.scene.lines.map((line) => '<li>' + esc(line) + '</li>').join("") + '</ul></div>' : '');
  }

  function bulletinSheet(state) {
    const lines = state.scene.lines || [];
    const changes = [];
    const notes = [];
    let noting = false;
    lines.forEach(function (line) {
      if (line === "原因") { noting = true; return; }
      (noting ? notes : changes).push(line);
    });
    const pct = Math.max(0, Math.min(100, state.score));
    return '<section class="card campus-card campus-card--warm summary"><div class="sumtop"><div><p class="eyebrow">年度结算</p><h1>' + esc(state.scene.title) + '</h1>' +
      '<p class="lede">' + esc(state.scene.body) + '</p></div>' +
      '<div class="ring" style="--p:' + pct + '"><span><b>' + state.score + '</b><em>综合评分</em></span></div></div>' +
      '<ul class="deltas">' + changes.map(deltaHtml).join("") + '</ul></section>' +
      (notes.length
        ? (UI
          ? UI.card({ title: "原因", body: '<ul class="log">' + notes.map(function (line) { return '<li>' + esc(line) + '</li>'; }).join("") + '</ul>' })
          : '<section class="card"><h2>原因</h2><ul class="log">' + notes.map(function (line) { return '<li>' + esc(line) + '</li>'; }).join("") + '</ul></section>')
        : '') +
      decisionButtons(state);
  }

  function deltaHtml(line) {
    const up = /（\+/.test(line);
    const down = /（-/.test(line);
    const cls = up ? "up" : down ? "down" : "";
    return '<li class="' + cls + '">' + esc(line) + '</li>';
  }

  function decisionButtons(state) {
    if (state.scene) {
      const only = state.scene.choices.length === 1;
      return '<div class="choices event-choices">' + state.scene.choices.map((c) => {
        if (UI && only) {
          return UI.button({
            variant: "primary",
            html: "<b>" + esc(c.label) + "</b>" + (c.detail ? "<small>" + esc(c.detail) + "</small>" : ""),
            attrs: { "data-act": "choice", "data-arg": c.id }
          });
        }
        return '<button class="' + (only ? "primary campus-btn campus-btn--primary" : "choice-card campus-btn campus-btn--secondary") +
          '" data-act="choice" data-arg="' + esc(c.id) + '"><b>' + esc(c.label) + '</b>' +
          (c.detail ? '<small>' + esc(c.detail) + '</small>' : '') + '</button>';
      }).join("") + '</div>';
    }
    return "";
  }

  function actionGroup(state, list) {
    const icons = { build: "build", campus: "campus", recruit: "recruit", world: "world", donate: "donate", office: "office", gov: "gov", students: "students", inspect: "inspect", teach: "teach", project: "book", apply: "apply" };
    return '<div class="actions">' + list.map(function (a) {
      const disabled = a.disabled || (a.once && state.used[a.id]) || state.funds < a.cost || (!a.free && state.actionsLeft <= 0);
      const tail = a.cost ? '<em>' + wan(a.cost) + '</em>' : '<em class="go">' + icon("go") + '</em>';
      return '<button data-act="action" data-arg="' + a.id + '"' + (disabled ? " disabled" : "") + '><span class="ico">' + icon(icons[a.id] || "build") + '</span><span class="actxt"><b>' + a.name +
        '</b><small>' + esc(a.desc) + '</small></span>' + tail + '</button>';
    }).join("") + '</div>';
  }

  function renderEnding(state) {
    const e = state.ending;
    const band = worldBand(rankScore(state));
    const ranked = state.depts.slice().sort((a, b) => b.strength - a.strength);
    const best = ranked[0];
    const worst = ranked[ranked.length - 1];
    return '<div class="shell intro">' + appBar("任期结算") +
      '<section class="intro-hero"><div class="copy"><p class="eyebrow">本局已结束</p><h1>' + esc(e.title) + '</h1>' +
      '<p class="lede">' + esc(e.text) + '</p></div>' +
      (heroArt("principal") || campusArt(false)) + '</section>' +
      '<section class="card summary"><div class="sumtop"><div><h2>' + esc(state.schoolName) + '</h2>' +
      '<p class="meta">' + tierLabel(state) + ' · 寰球榜 ' + band.label + ' · 报考 ' + (state.enrollment == null ? "—" : state.enrollment) + '</p></div>' +
      '<div class="ring" style="--p:' + Math.max(0, Math.min(100, state.score)) + '"><span><b>' + state.score + '</b><em>综合评分</em></span></div></div></section>' +
      '<div class="rowcard"><span>收过的好处 <b>' + state.bribes + '</b></span><span class="side">被举报 ' + state.reports + ' 次</span></div>' +
      '<section class="card"><h2>停在这一档</h2><p class="lede">' + esc(e.stamp) + '。最强的是' + deptName(best.id) + ' ' + best.strength + '，最短的是' + deptName(worst.id) + ' ' + worst.strength + '。</p>' +
      '<p class="fine">数字按离任那天固定。这一届不能再改。</p></section>' +
      (UI
        ? UI.button({ variant: "primary", label: "再当一届", attrs: { "data-act": "restart" } })
        : '<button class="primary" data-act="restart">再当一届</button>') + '</div>';
  }

  function statLine(k, v) { return '<div><span>' + k + '</span><b>' + v + '</b></div>'; }

  function loadRaw() {
    try { return JSON.parse(localStorage.getItem(SAVE_KEY) || "null"); } catch (e) { return null; }
  }
  function save(state) {
    try {
      if (state.mode === "intro") return;
      localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    } catch (e) { /* ignore quota */ }
  }
  function clearSave() {
    try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ }
  }

  function mount(app) {
    if (!app) return;
    let state = { mode: "intro" };

    function draw() {
      syncSafe(state);
      app.innerHTML = render(state);
      save(state);
      const input = app.querySelector("#school");
      if (input) input.focus();
    }

    function syncSafe(s) {
      if (s && s.depts) {
        ensureSeason(s);
        campusOf(s);
        ensureExtras(s);
        s.score = computeScore(s);
      }
    }

    app.addEventListener("click", (event) => {
      const btn = event.target.closest("[data-act]");
      if (!btn || btn.disabled) return;
      const act = btn.dataset.act;
      if (act === "origin") {
        origin = btn.dataset.arg || "old";
        draw();
        return;
      }
      if (act === "start") {
        const input = app.querySelector("#school");
        const name = (input && input.value.trim()) || "江湾";
        state = createState(name, origin);
        state.mode = "play";
        screen = "do";
        draw();
        window.scrollTo(0, 0);
        return;
      }
      if (act === "continue") {
        const saved = loadRaw();
        if (saved && saved.depts) state = saved;
        draw();
        window.scrollTo(0, 0);
        return;
      }
      if (act === "restart") {
        clearSave();
        state = { mode: "intro" };
        screen = "do";
        draw();
        window.scrollTo(0, 0);
        return;
      }
      if (act === "tab") {
        screen = btn.dataset.arg || "do";
        if (screen !== "people") {
          peopleDetailId = null;
        } else if (!peoplePane) {
          peoplePane = "overview";
        }
        draw();
        window.scrollTo(0, 0);
        return;
      }
      if (act === "people-pane") {
        peoplePane = btn.dataset.arg || "overview";
        peopleDetailId = null;
        screen = "people";
        draw();
        window.scrollTo(0, 0);
        return;
      }
      if (act === "filter-toggle") {
        peopleFilterOpen = !peopleFilterOpen;
        draw();
        return;
      }
      if (act === "filter") {
        peopleFilter = btn.dataset.arg || "all";
        peopleFilterOpen = true;
        peopleDetailId = null;
        draw();
        return;
      }
      if (act === "teacher") {
        peopleDetailId = btn.dataset.arg || null;
        screen = "people";
        draw();
        window.scrollTo(0, 0);
        return;
      }
      if (act === "teacher-back") {
        peopleDetailId = null;
        screen = "people";
        draw();
        window.scrollTo(0, 0);
        return;
      }
      if (act === "school-pane") {
        schoolPane = btn.dataset.arg || "overview";
        draw();
        return;
      }
      if (act === "do-pane") {
        doPane = btn.dataset.arg === "year" ? "results" : (btn.dataset.arg || "tasks");
        screen = "do";
        draw();
        return;
      }
      if (act === "apply-filter") {
        applyGateFilter = btn.dataset.arg || "all";
        screen = "apply";
        draw();
        return;
      }
      if (act === "apply-expand") {
        const id = btn.dataset.arg || "";
        applyExpandId = applyExpandId === id ? null : id;
        screen = "apply";
        draw();
        return;
      }
      if (act === "action") {
        perform(state, btn.dataset.arg);
        screen = "do";
      }
      if (act === "choice") {
        choose(state, btn.dataset.arg);
        screen = "do";
      }
      draw();
      window.scrollTo(0, 0);
    });

    draw();
  }

  return {
    createState,
    perform,
    choose,
    computeScore,
    gates,
    gateReady,
    worldBand,
    rankScore,
    mount,
    YEARS
  };
});
