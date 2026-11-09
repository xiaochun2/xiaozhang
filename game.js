(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.SchoolGame = api;
  if (typeof document !== "undefined") api.mount(document.getElementById("app"));
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const YEARS = 14;
  const SAVE_KEY = "president-sim-v3";

  const DEPTS = [
    { id: "sci", name: "理学", role: "学术和升格的硬指标" },
    { id: "eng", name: "工学", role: "科研、就业、能看见的成果" },
    { id: "cs", name: "计算机", role: "论文和国际合作" },
    { id: "biz", name: "经管", role: "校友、捐赠、学校的钱" },
    { id: "hum", name: "文法", role: "声誉，也是舆论和举报信" },
    { id: "med", name: "医学", role: "社会服务，太弱会被评估点名" }
  ];

  const RANKS = ["讲师", "副教授", "教授", "学科带头人"];
  const TIERS = [
    { name: "大专", short: "高职" },
    { name: "本科", short: "本科" },
    { name: "211", short: "211" },
    { name: "985", short: "985" }
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
  function avgDept(state) {
    return state.depts.reduce((s, d) => s + d.strength, 0) / state.depts.length;
  }
  function leverageTeachers(state) { return state.teachers.filter((t) => t.leverage); }

  function fullName(base, tier) {
    const stem = String(base || "江湾").trim().replace(/(职业技术学院|职业学院|专科学校|学院|大学)$/g, "") || "江湾";
    if (tier <= 0) return stem + "职业技术学院";
    if (tier === 1) return stem + "学院";
    return stem + "大学";
  }

  function makeTeacher(deptId, extra) {
    const greed = extra && extra.greed != null ? extra.greed : rand(100);
    return Object.assign({
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
  }

  function createState(baseName) {
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
      actionsLeft: 2,
      used: {},
      reviewCursor: 0,
      phase: "play",
      scene: null,
      queue: [],
      ending: null,
      mode: "play",
      enrollment: 46,
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
    state.score = computeScore(state);
    note(state, "董事会把印交给你。十四年，从这所大专开始算。");
    markOpening(state);
    return state;
  }

  function note(state, text) {
    state.log.unshift(text);
    state.log = state.log.slice(0, 8);
    if (!state.yearNotes) state.yearNotes = [];
    state.yearNotes.push(text);
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
      depts: state.depts.map((d) => ({ id: d.id, strength: d.strength }))
    };
    state.yearNotes = [];
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

  function gates(state) {
    const g = Object.fromEntries(state.depts.map((d) => [d.id, d.strength]));
    const others = ["eng", "cs", "biz", "hum", "med"].filter((id) => g[id] >= 56).length;
    const strong = state.depts.filter((d) => d.strength >= 60).length;
    const readyDepts = state.depts.filter((d) => d.strength >= 32).length;
    const min = Math.min(...state.depts.map((d) => d.strength));
    if (state.tier <= 0) {
      return {
        title: "升本",
        cost: 12,
        items: [
          item("综合评分", state.score, 40),
          item("教学", state.teaching, 42),
          item("四个系达到 32", readyDepts, 4),
          item("风纪", state.compliance, 50),
          item("最短的系不低于 18", min, 18),
          item("报考热度", state.enrollment || 0, 30),
          item("经费", state.funds, 12)
        ]
      };
    }
    if (state.tier === 1) {
      return {
        title: "211",
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
          item("经费", state.funds, 18)
        ]
      };
    }
    if (state.tier === 2) {
      return {
        title: "985",
        cost: 22,
        items: [
          item("综合评分", state.score, 66),
          item("学术", state.academic, 64),
          item("理学", g.sci, 60),
          item("三个系达到 60", strong, 3),
          item("国际影响", state.international, 40),
          item("风纪", state.compliance, 62),
          item("把柄风险", state.heat, 29, true),
          item("举报创伤", state.wound, 9, true),
          item("实名举报次数", state.reports, 2, true),
          item("经费", state.funds, 22)
        ]
      };
    }
    return null;
  }

function item(label, value, need, below) {
  const ok = below ? value < need : value >= need;
  const shown = below ? (ok ? "达标" : "未达标") : Math.round(value) + " / " + need;
  return { label, ok, shown };
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
      state.phase = "scene";
      return;
    }
    if (state.phase === "year-events" || state.afterEvents) {
      state.afterEvents = false;
      settleYear(state);
      return;
    }
    state.phase = "play";
  }

  function actionsCatalog(state) {
    const g = gates(state);
    return [
      { id: "build", name: "学科建设", desc: "一年只有一个名额。养这个系，没排上的系会薄。", cost: 8, once: true },
      { id: "recruit", name: "引进人才", desc: "高薪挖一个人。贪不贪，见面才知道。", cost: 14, once: false },
      { id: "world", name: "国际合作", desc: "交换、联培，榜单上能看见的那种。", cost: 10, once: false },
      { id: "donate", name: "校友募捐", desc: "干净的钱，来得不快。", cost: 0, once: true },
      { id: "inspect", name: "内部巡察", desc: "想把把柄切掉。对方也会察觉。", cost: 4, once: true },
      { id: "teach", name: "教学评估", desc: "补升本最看的那一栏。", cost: 6, once: true },
      { id: "apply", name: g ? "申报" + g.title : "已是顶尖", desc: g ? "条件够了才递材料。" : "这一档已经到顶。", cost: g ? g.cost : 0, once: true, disabled: !g }
    ];
  }

  function perform(state, id, arg) {
    const spec = actionsCatalog(state).find((a) => a.id === id);
    if (!spec || spec.disabled) return;
    if (spec.once && state.used[id]) {
      openQueue(state, [scene("今年做过了", "同一件事一年只办一次。", cont("返回"))]);
      return;
    }
    if (state.funds < spec.cost) {
      openQueue(state, [scene("经费不够", "账上盖不住这次开支。先去募捐，或者换一件事。", cont("返回"))]);
      return;
    }
    if ((id === "build" || id === "recruit") && !arg) {
      openQueue(state, [deptPick(state, id)]);
      return;
    }
    if (id === "apply") return doApply(state);
    if (id === "build") return doBuild(state, arg);
    if (id === "recruit") return doRecruit(state, arg);
    if (id === "world") return doWorld(state);
    if (id === "donate") return doDonate(state);
    if (id === "inspect") return doInspect(state);
    if (id === "teach") return doTeach(state);
  }

  function spendAction(state, id, cost) {
    state.funds -= cost;
    state.used[id] = true;
    state.actionsLeft -= 1;
  }

  function finishAction(state, card) {
    if (state.actionsLeft <= 0) {
      state.afterEvents = true;
      state.phase = "year-events";
      const events = yearEvents(state);
      state.queue = [card].concat(events).filter(Boolean);
      state.scene = state.queue.shift() || null;
      if (!state.scene) settleYear(state);
      return;
    }
    openQueue(state, [card]);
  }

  function deptPick(state, action) {
    return scene(
      action === "build" ? "建设哪个系" : "人才引进到哪个系",
      "每个系影响的东西不一样。理学卡升格，计算机拉排名，经管出钱，医学太弱会被点名，文法会把舆论放大。",
      state.depts.map((d) => {
        const meta = DEPTS.find((x) => x.id === d.id);
        const empty = deptTeachers(state, d.id).length ? "" : " · 没有带头人";
        return { id: "pick:" + action + ":" + d.id, label: meta.name + "  " + d.strength, detail: meta.role + empty };
      }).concat([{ id: "cont", label: "返回" }])
    );
  }

  function neglectDrops(focusId) {
  const stem = focusId === "sci" || focusId === "cs" || focusId === "eng";
  if (stem) return { hum: 2, med: 2 };
  if (focusId === "biz") return { sci: 2, cs: 1 };
  return { sci: 2, eng: 1 };
}

function doBuild(state, deptId) {
    spendAction(state, "build", 8);
    bumpDept(state, deptId, 8);
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
    note(state, "建设名额进了" + meta.name + "。" + dropped.join("，") + "。");
    sync(state);
    finishAction(state, scene(
      meta.name + "动起来了",
      "一年只有一个名额。没排上的系没人管：" + dropped.join("，") + "。",
      cont()
    ));
  }

  function doRecruit(state, deptId) {
    spendAction(state, "recruit", 14);
    const greed = rand(100);
    const teacher = makeTeacher(deptId, { talent: 68 + rand(28), greed, rank: greed > 78 ? 2 : 2 });
    state.teachers.push(teacher);
    bumpDept(state, deptId, 5);
    addStat(state, "academic", 2);
    const meta = DEPTS.find((d) => d.id === deptId);
    note(state, teacher.name + "加入" + meta.name + "。");
    const greedy = greed >= 72;
    sync(state);
    finishAction(state, scene(
      greedy ? "人来了，话也多" : "引进了一位能干活的人",
      greedy
        ? teacher.name + "的履历够用。饭局里他已经在问，特殊人才的安家费能不能走一张不好审计的表。"
        : teacher.name + "进了" + meta.name + "。短期内这个系会好带一些。",
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
    if (!shown.length) return scene(meta.name + "没有可评的人", "这个系的人都已经是学科带头人。", cont());
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
    if (!choices.length) return scene("今年没有可评的人", "在任的人都已经是学科带头人。", cont());
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
    const money = 12 + Math.round((biz - 30) * 0.2);
    state.funds = clamp(state.funds + money, 0, 220);
    addStat(state, "reputation", biz >= 50 ? 4 : 2);
    note(state, "校友这一年进来 " + money + " 点经费。");
    sync(state);
    finishAction(state, scene("钱是干净的", "经管越强，这份名单越好看。没有人顺便把信封留下。", cont()));
  }

  function doTeach(state) {
    spendAction(state, "teach", 6);
    addStat(state, "teaching", 8);
    addStat(state, "reputation", 2);
    note(state, "教学评估过了一轮。");
    sync(state);
    finishAction(state, scene("课堂被看过了", "升本看的就是这个。顶尖学府不会只看这个。", cont()));
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

  function doApply(state) {
    const g = gates(state);
    if (!g) return;
    if (!gateReady(state)) {
      openQueue(state, [scene("材料还递不出去", "右边和左边的条件里还有没达到的。这次不消耗行动。", cont("返回"))]);
      return;
    }
    spendAction(state, "apply", g.cost);
    state.tier += 1;
    state.schoolName = fullName(state.baseName, state.tier);
    addStat(state, "reputation", 8);
    addStat(state, "academic", 3);
    note(state, "学校升到「" + TIERS[state.tier].name + "」。");
    sync(state);
    const title = state.tier === 1 ? "升本通过" : state.tier === 2 ? "进入 211 这一档" : "进入 985 这一档";
    finishAction(state, scene(title, "牌子可以换。后面的榜单、学科和把柄，都不会因为揭牌自动消失。", cont("看今年的后半段")));
  }

function yearEvents(state) {
  const events = [];
  if (state.year === 1) return [scriptedBribe(state)];
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
  else if (!pressure && Math.random() < 0.8) events.push(pick(ambientEvents())(state));
  return events.filter(Boolean);
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
    if (state.story.incidentKind === "post") {
      return scene("一篇实名帖", "帖子点了" + meta + "的一门课，在校外传了一天。本地媒体问学校有没有回应。", [
        { id: "story:post-bury", label: "先把热度压下去", detail: "风险上升，报考会慢一截" },
        { id: "story:post-open", label: "公开查这门课", detail: "风纪上升，这个系要挨一下" },
        { id: "story:post-face", label: "让任课教师出面", detail: "看这个系的人怎么说话" }
      ], { kind: "event" });
    }
    if (state.story.incidentKind === "accident") {
      return scene("校庆台阶塌了一角", meta + "楼前的临时台阶塌了。没有重伤。视频先于通报出去。", [
        { id: "story:accident-cold", label: "冷处理", detail: "声誉和报考一起往下" },
        { id: "story:accident-pay", label: "赔偿并公开", detail: "花钱，声誉能回来" },
        { id: "story:accident-blame", label: "追到这个系", detail: "系会薄，风纪回升" }
      ], { kind: "event" });
    }
    return scene(meta + "停了两周课", "学生把理由写在教学楼上：课表排得下，带教的人不够。最短的就是这个系。", [
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
      note(state, "会上点了" + rivalTitle(state) + "的短处。");
    }
  }

  function scriptedBribe(state) {
    const teacher = deptTeachers(state, "eng").slice().sort((a, b) => a.rank - b.rank)[0] || state.teachers[0];
    teacher.greed = Math.max(teacher.greed, 75);
    if (teacher.rank > 1) teacher.rank = 1;
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
      "他要你在下一个名单里直接写他的名字。",
      "他实验室的账对不上，要你让审计这学期别进这个系。",
      "他要一个不受名额限制的留校名额，给自己的学生。"
    ];
    return scene(
      teacher.name + "来兑现",
      meta.name + "的" + teacher.name + "握着你收钱的那件事。" + pick(asks),
      [
        { id: "help:" + teacher.id, label: "帮", detail: "人留下，系变强，风险和学术水分上升" },
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
  return [mediaEvent, giftEvent, poachEvent, contestEvent];
}

function mediaEvent(state) {
  const band = worldBand(rankScore(state));
  return scene("今年的榜", "寰球榜把学校放在「" + band.label + "」。区域榜是「" + regionBand(rankScore(state)) + "」。没有申述，就按这个数字过年。", cont("收下这个名次"), { kind: "event" });
}

function giftEvent() {
  return scene("一笔不带名字的省里拨款", "文件写的是学科建设。没有人要求你回报。", [
    { id: "grant-sci", label: "投给理学", detail: "学术和升格都会松一点" },
    { id: "grant-med", label: "补医学", detail: "把最短的社会服务补一截" },
    { id: "grant-fund", label: "先存进经费", detail: "账上会多一截" }
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
  return scene("学生把奖杯带回来了", "一次干净的胜仗。可以写进明年的升格附件。", [
    { id: "contest-rep", label: "拿去抬声誉", detail: "社会评价更好看" },
    { id: "contest-acad", label: "拿去抬学术", detail: "对理学、工学这条线更有用" }
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
    const [kind, id] = choiceId.split(":");
    const teacher = id ? teacherById(state, id) : null;
    if (kind === "meet" && teacher) state.queue.unshift(reviewCard(teacher));
    else if (kind === "clean" && teacher) resolveClean(state, teacher);
    else if (kind === "take" && teacher) resolveTake(state, teacher);
    else if (kind === "skip" && teacher) {
      teacher.loyalty = clamp(teacher.loyalty - 12, 0, 100);
      note(state, teacher.name + "今年没有进入名单。");
    } else if (kind === "help" && teacher) resolveHelp(state, teacher);
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
      note(state, "加薪留下了" + teacher.name + "。");
    } else if (kind === "letgo" && teacher) {
      removeTeacher(state, teacher, -9);
      note(state, teacher.name + "去了别的学校。");
    } else if (kind === "grant-sci") {
      bumpDept(state, "sci", 7);
      addStat(state, "academic", 3);
      note(state, "省里的钱进了理学。");
    } else if (kind === "grant-med") {
      bumpDept(state, "med", 8);
      addStat(state, "reputation", 3);
      note(state, "省里的钱用来补医学。");
    } else if (kind === "grant-fund") {
      state.funds = clamp(state.funds + 14, 0, 220);
      note(state, "拨款先存进了经费。");
    }     else if (kind === "contest-rep") addStat(state, "reputation", 5);
    else if (kind === "contest-acad") addStat(state, "academic", 4);
    else if (kind === "story") resolveStory(state, id);
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

function resolveHelp(state, teacher) {
  teacher.rank = Math.min(3, teacher.rank + 1);
  bumpDept(state, teacher.dept, 5);
  addStat(state, "academic", -3);
  addStat(state, "heat", 10);
  addStat(state, "compliance", -6);
  teacher.loyalty = clamp(teacher.loyalty + 10, 0, 100);
  rememberProf(state, teacher, "helped");
  note(state, "你帮了" + teacher.name + "。系更强，把柄还在。");
  feedback(state, "你帮了", DEPTS.find((d) => d.id === teacher.dept).name + "更强了一截。学术水分和把柄风险也记上一笔。他手里的东西还在。");
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
    hit.lines.forEach((line) => note(state, line));
    sync(state);
    state.afterEvents = false;
    state.phase = "scene";
    state.queue = [];
    state.scene = scene(
      "第 " + state.year + " 年公报",
      "这一年动过的数字，和原因。",
      [{ id: "bulletin", label: "继续" }],
      { lines: bulletinLines(state, before), kind: "bulletin" }
    );
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
    state.year += 1;
    state.actionsLeft = 2;
    state.used = {};
    state.phase = "play";
    state.scene = null;
    markOpening(state);
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
    state.year += 1;
    state.actionsLeft = 2;
    state.used = {};
    state.phase = "play";
    state.scene = null;
    markOpening(state);
    note(state, how === "coop" ? "你配合了巡视，一批人离开，学校还在。" : "责任先推出去了，信暂时没有第二封。");
  }

  function endingCatalog() {
    return {
      world: end("世界一流", "建成", "十四年后，学校站在 985 这一档，寰球榜也进了前 200。把柄没有在揭牌那天炸开。"),
      top: end("顶尖学府", "985", "牌子已经是顶尖学府。榜单或者风纪还差一口气，但大专这两个字彻底留在旧文件里了。"),
      key: end("国家重点", "211", "学校停在 211 这一档。不是传说里的顶尖，但已经不是当初那所职业技术学院。"),
      college: end("升本止步", "本科", "本科牌子拿到了。再往上的学术、理学和排名，这一届没有凑齐。"),
      vocational: end("大专收场", "未升", "十四年用完，学校还是大专。有的系变强了，整所学校没有跨过那道门。"),
      ruined: end("评分崩盘", "重估", "举报和创伤把综合评分打穿。上面不再讨论排名，只讨论这所学校还要不要保留建制。"),
      downfall: end("校长离任", "离任", "巡视没有给你把任期做完的机会。学校的档次停在你离开的那一天。"),
      scandal: end("排名作废", "除名", "你曾经把学校送进榜单。信被公开之后，这一档排名被撤下，揭牌词不再使用。"),
      clean: end("清誉调任", "调任", "你几乎没让把柄留下。上面调你去管另一所学校。江湾升得有限，你的名字却是干净的。"),
      warlord: end("学阀架空", "架空", "最强的那个系握着你的把柄，最弱的系已经没人管。校长室还在，议程不是你在定。"),
      hollow: end("人才走空", "空校", "带头人走得太多，六个系托不住一个校名。评估组来的时候，实验室是锁着的。"),
      specialty: end("一科成名", "单科", "学校没有挤进 211，但有一个系强到业内会单独提起。这是一所特种学校，不是综合大学。")
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

    const elite = state.tier >= 3 && band.index >= 6 && state.heat <= 30 && state.wound <= 8 && state.score >= 74;
    if (elite) return book.world;
    if (!finalYear && state.year < YEARS) return null;
    if (maxDept.strength >= 84 && minStrength <= 28 && maxLead && maxLead.leverage) return book.warlord;
    if (state.tier >= 3) return book.top;
    if (state.tier >= 2) return book.key;
    if (state.bribes === 0 && state.compliance >= 78 && state.reports === 0) return book.clean;
    if (maxDept.strength >= 80) return book.specialty;
    if (state.tier >= 1) return book.college;
    return book.vocational;
  }

  function freshYear(state) {
    return state;
  }

  function render(state) {
    if (state.mode === "intro") return renderIntro(state);
    if (state.mode === "end") return renderEnding(state);
    return renderGame(state);
  }

  function renderIntro(state) {
    const saved = loadRaw();
    return '<div class="intro"><div class="intro-card">' +
      '<p class="eyebrow">FICTIONAL TERM · 14 YEARS</p>' +
      '<h1>校长模拟器</h1>' +
      '<p class="lede">把一所大专送到本科、211、985，再送到国际榜上。教师会贪污，也会贿赂你。收下，把柄就在别人手里。</p>' +
      '<ul class="rules">' +
      '<li><strong>升档</strong>看综合评分、理学、各系短板、风纪和国际影响。每年只能重点建设一个系，理工上去时，文法和医学会往下掉。</li>' +
      '<li><strong>评审</strong>逢双年必开。同一个系里看成果、看谁夹着信封、看谁握有把柄，名额只有一个。</li>' +
      '<li><strong>把柄</strong>来自你收过的钱。之后他来找你：帮，系会变强，风险也在；不帮，他可能离职，也可能举报。</li>' +
      '<li><strong>举报</strong>直接伤学校综合评分。文法越强，这件事越压不住。</li>' +
      '<li><strong>报考</strong>经管和医学抬热度，短板和举报往下压。热度不够，升本和 211 的材料递不出去。年终有公报。有的人、隔壁学校、一次公开事件，会在后面几年接着写。</li>' +
      '</ul>' +
      '<label for="school">学校的名字</label>' +
      '<input id="school" type="text" maxlength="12" value="江湾" />' +
      '<div class="intro-actions">' +
      '<button class="primary" data-act="start">开始任期</button>' +
      (saved ? '<button data-act="continue">继续上一届</button>' : '') +
      '</div></div></div>';
  }

  function renderGame(state) {
    const band = worldBand(rankScore(state));
    const g = gates(state);
    return '<div class="shell">' +
      '<header class="top"><div><h1 class="school-name">' + esc(state.schoolName) + '</h1>' +
      '<p class="year-label">第 ' + state.year + ' 年 / ' + YEARS + ' · 本年还能做 ' + state.actionsLeft + ' 件事' +
      (state.year % 2 === 0 ? ' · 年终开职称评审' : '') + '</p></div>' +
      '<div class="score-block"><span>综合评分</span><div class="score-num">' + state.score + '</div></div></header>' +
      ladderHtml(state) +
      '<div class="ranks"><div>寰球榜 <b>' + band.label + '</b></div><div>东亚区域榜 <b>' + regionBand(rankScore(state)) + '</b></div></div>' +
      '<div class="layout">' +
      '<aside class="panel"><h2>六个系</h2>' + state.depts.map((d) => deptHtml(state, d)).join("") +
      (g ? '<h2 style="margin-top:16px">申报' + g.title + '</h2><ul class="gates">' + g.items.map(gateHtml).join("") + '</ul>' : '<p class="note">已经站在 985 这一档。剩下的是榜单和有没有炸。</p>') +
      '</aside>' +
      '<section class="panel stage">' + mainHtml(state) + '</section>' +
      '<aside class="panel"><h2>学校</h2>' + statsHtml(state) +
      '<div class="log"><h2 style="margin-top:14px">本年备忘</h2><ul>' + state.log.map((l) => '<li>' + esc(l) + '</li>').join("") + '</ul></div></aside>' +
      '</div>' +
      '<div class="faculty">' + facultyHtml(state) + '</div>' +
      '</div>';
  }

  function ladderHtml(state) {
    return '<div class="ladder">' + TIERS.map((t, i) => {
      const cls = i === state.tier ? "on" : i < state.tier ? "done" : "";
      return '<div class="rung ' + cls + '"><small>0' + (i + 1) + '</small><b>' + t.name + '</b></div>';
    }).join("") + '</div>';
  }

  function deptHtml(state, d) {
    const meta = DEPTS.find((x) => x.id === d.id);
    const weak = d.strength < 24;
    return '<div class="dept"><div class="row"><b>' + meta.name + '</b><span>' + d.strength + '</span></div>' +
      '<div class="bar ' + (weak ? "weak" : "") + '"><i style="width:' + d.strength + '%"></i></div>' +
      '<div class="hint">' + meta.role + '</div></div>';
  }

  function gateHtml(it) {
    return '<li><span>' + it.label + '</span><span class="' + (it.ok ? "ok" : "no") + '">' + it.shown + '</span></li>';
  }

  function statsHtml(state) {
    const rows = [
      ["学术", state.academic],
      ["教学", state.teaching],
      ["声誉", state.reputation],
      ["报考热度", state.enrollment || 0],
      ["经费", state.funds],
      ["风纪", state.compliance],
      ["把柄风险", state.heat],
      ["举报创伤", state.wound]
    ];
    return rows.map((r) => '<div class="stat"><em>' + r[0] + '</em><b>' + r[1] + '</b></div>').join("");
  }

  function facultyHtml(state) {
    const cards = DEPTS.map((meta) => {
      const people = deptTeachers(state, meta.id);
      if (!people.length) return '<div class="person empty"><b>' + meta.name + '</b><div class="meta">没有带头人，年底这个系会往下掉。</div></div>';
      return people.map((t) => '<div class="person"><div class="who"><b>' + esc(t.name) + '</b>' +
        (t.leverage ? '<span class="tag">把柄</span>' : '') + '</div><div class="meta">' + meta.name + ' · ' + RANKS[t.rank] +
        ' · 学术 ' + t.talent + (t.skimming ? ' · 账上有洞' : '') + '</div></div>').join("");
    });
    return cards.join("");
  }

  function mainHtml(state) {
    if (state.scene) {
      return '<p class="eyebrow">MEMO</p><h2 class="memo">' + esc(state.scene.title) + '</h2>' +
        '<p class="memo-body">' + esc(state.scene.body) + '</p>' +
        (state.scene.lines ? '<ul class="bulletin">' + state.scene.lines.map((line) => '<li>' + esc(line) + '</li>').join("") + '</ul>' : '') +
        '<div class="choices">' + state.scene.choices.map((c) =>
          '<button data-act="choice" data-arg="' + esc(c.id) + '"><b>' + esc(c.label) + '</b>' +
          (c.detail ? '<small>' + esc(c.detail) + '</small>' : '') + '</button>'
        ).join("") + '</div>';
    }
    const list = actionsCatalog(state);
    return '<p class="eyebrow">THIS YEAR</p><h2 class="memo">今年先办哪两件事</h2>' +
      '<p class="note">学科建设一年一次。引进和国际合作可以再做。募捐、巡察、教学和申报一年一次。逢双年，两件事办完就开职称评审。</p>' +
      '<div class="actions">' + list.map((a) => {
        const disabled = a.disabled || (a.once && state.used[a.id]) || state.funds < a.cost;
        return '<button data-act="action" data-arg="' + a.id + '"' + (disabled ? " disabled" : "") + '><b>' + a.name +
          (a.cost ? ' · ' + a.cost : '') + '</b><span>' + a.desc + '</span></button>';
      }).join("") + '</div>';
  }

  function renderEnding(state) {
    const e = state.ending;
    const band = worldBand(rankScore(state));
    const ranked = state.depts.slice().sort((a, b) => b.strength - a.strength);
    const best = ranked[0];
    const worst = ranked[ranked.length - 1];
    return '<div class="ending"><div class="ending-card"><div class="stamp">' + esc(e.stamp) + '</div>' +
      '<p class="eyebrow">任期卡 · 第 ' + state.year + ' 年</p>' +
      '<h1>' + esc(state.schoolName) + '</h1>' +
      '<p class="tenure-title">' + esc(e.title) + '</p>' +
      '<div class="end-grid">' +
      statLine("档次", TIERS[state.tier].name) +
      statLine("寰球榜", band.label) +
      statLine("收过的好处", state.bribes + " 笔") +
      statLine("被举报", state.reports + " 次") +
      statLine("最强的系", deptName(best.id) + " " + best.strength) +
      statLine("最短的系", deptName(worst.id) + " " + worst.strength) +
      statLine("报考热度", state.enrollment == null ? "—" : state.enrollment) +
      statLine("综合评分", state.score) +
      '</div><p class="verdict">' + esc(e.text) + '</p>' +
      '<button class="primary" data-act="restart">再当一届</button></div></div>';
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
      if (s && s.depts) s.score = computeScore(s);
    }

    app.addEventListener("click", (event) => {
      const btn = event.target.closest("[data-act]");
      if (!btn || btn.disabled) return;
      const act = btn.dataset.act;
      if (act === "start") {
        const input = app.querySelector("#school");
        const name = (input && input.value.trim()) || "江湾";
        state = createState(name);
        state.mode = "play";
        draw();
        return;
      }
      if (act === "continue") {
        const saved = loadRaw();
        if (saved && saved.depts) state = saved;
        draw();
        return;
      }
      if (act === "restart") {
        clearSave();
        state = { mode: "intro" };
        draw();
        return;
      }
      if (act === "action") perform(state, btn.dataset.arg);
      if (act === "choice") choose(state, btn.dataset.arg);
      draw();
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
