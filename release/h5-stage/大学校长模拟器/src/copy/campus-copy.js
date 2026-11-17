/* 校长模拟器 · 校园沉浸文案（办事 / 学校 / 教师 / 申报）
 * 只产出文案，不改数值 / 条件 / 消耗。
 */
(function (global) {
  "use strict";

  function seasonOf(state) {
    var s = (state && state.season) || 0;
    return ["春", "夏", "秋", "冬"][s] || "春";
  }

  function fundsBand(state) {
    var f = state && state.funds != null ? state.funds : 0;
    if (f < 16) return "tight";
    if (f < 32) return "careful";
    return "ok";
  }

  function staffGap(state) {
    if (!state || !state.depts || !state.teachers) return false;
    return state.depts.some(function (d) {
      return !state.teachers.some(function (t) { return t.dept === d.id; });
    });
  }

  function heatHigh(state) {
    return !!(state && state.heat >= 40);
  }

  function overCapacity(state) {
    var c = state && state.campus;
    if (!c) return false;
    var cap = (c.mu || 0) * 8 + ((c.buildings && c.buildings.dorm) || 0) * 800;
    return (c.students || 0) > cap;
  }

  function pickByState(state, variants) {
    var keys = Object.keys(variants);
    if (!keys.length) return "";
    if (variants.default != null && keys.length === 1) return variants.default;
    if (fundsBand(state) === "tight" && variants.tight) return variants.tight;
    if (staffGap(state) && variants.staff) return variants.staff;
    if (heatHigh(state) && variants.heat) return variants.heat;
    if (overCapacity(state) && variants.crowd) return variants.crowd;
    if (seasonOf(state) === "冬" && variants.winter) return variants.winter;
    if (seasonOf(state) === "夏" && variants.summer) return variants.summer;
    return variants.default || variants[keys[0]];
  }

  function actionPack(state) {
    var pending = state && state.campus && state.campus.pending;
    var cs = 0;
    if (state && state.depts) {
      var row = state.depts.filter(function (d) { return d.id === "cs"; })[0];
      cs = row ? row.strength : 0;
    }
    var tier = state && state.tier != null ? state.tier : 0;
    var focusTeach = tier <= 0;

    return {
      build: {
        name: "学科建设",
        desc: pickByState(state, {
          default: "教务处把各系的建设申请摊在桌上：名额只有一个。点到的系会厚一点，旁边的系难免要自己扛一阵。",
          staff: "有的系还缺带头人，建设申请写得特别急。名额一年一个，教务处等校长定。",
          tight: "账上不算宽裕，可各系仍把建设申请送了上来。名额只有一个，得想清楚给谁。"
        })
      },
      campus: {
        name: "基建",
        desc: pending
          ? "工地还围着，上一座楼要明年春天才能用。后勤处说，今年先别急着再开工。"
          : pickByState(state, {
            default: "后勤处送来几份图纸：宿舍、实验楼、实训楼……地要找政府要，楼一年只能动一座。",
            crowd: "学生已经住得偏紧，后勤处把宿舍和占地的数字圈了出来，希望校长抽空拍板。",
            tight: "想盖楼的心是有的，可账本也在桌上。后勤处问：这一座，还开不开工？"
          })
      },
      recruit: {
        name: "引进人才",
        desc: pickByState(state, {
          default: "人事处筛出几份简历，附上各系的缺人说明。出身和擅长会拉动不同方向，贪的来做副教授时，账也要一起看。",
          staff: "有的系连带头人都空着。人事处把简历往前推了推，希望校长尽快见面。",
          summer: "暑假前后是招人窗口。人事处说，再晚一点，合适的人可能先被别的学校约走。"
        })
      },
      world: {
        name: "国际合作",
        desc: cs >= 50
          ? "国际处送来一份交换联培意向。计算机系撑得住门面，签下去，榜单上也能看见一点动静。"
          : "国际处想谈合作，可计算机系还偏弱。签了更像短期访问，别指望立刻撑起国际影响。"
      },
      donate: {
        name: "校友募捐",
        desc: pickByState(state, {
          default: "校友办约了几位老校友吃饭。钱能进来，最短的那个系大概要先委屈一下。",
          tight: "账上紧的时候，校友办的电话反而更勤。募捐能救急，也要接受一点取舍。"
        })
      },
      office: {
        name: "校长办公会",
        desc: "办公室把议题收成三叠：挪一笔经费、处分一个人，或签发一份文件。这一次只能拍一件。"
      },
      gov: {
        name: "找政府",
        desc: tier >= 1 && state.track === "vocational"
          ? "市政府联络员问：专项、招生名额、一块地，还是职业本科之后的整合请示？一次只好谈一类。"
          : "市政府联络员问：专项经费、招生名额，还是一块地？一次只好谈一类，别全要。"
      },
      students: {
        name: "学生事务",
        desc: pickByState(state, {
          default: "学工处送来两件事：学生处分，或就业数据怎么对外说。今年若完全不露面，论坛上的声音会更冲。",
          crowd: "宿舍和食堂的意见贴又冒了出来。学工处希望校长至少表个态，别只让辅导员顶着。"
        })
      },
      inspect: {
        name: "内部巡察",
        desc: pickByState(state, {
          default: "纪检办想在校内走一圈，把柄能削就削。被问到的人不会毫无察觉。",
          heat: "把柄风险已经不低。纪检办建议尽早巡察，再拖，外面的信可能比校内动作更快。"
        })
      },
      teach: {
        name: "教学评估",
        desc: focusTeach
          ? "评建办把听课表和试卷抽查摆上来：升本最看教学这一栏。这一季补教学，学术先不动。"
          : "评建办说，短板不在课堂而在别处。这一季按补短板来，教学数字先按兵不动。"
      },
      project: {
        name: "报课题",
        desc: tier < 1
          ? "科技处想报课题，可学校还没升本。材料可以准备，正式申报要等本科牌子。"
          : "科技处物色到一个可挂名的题目：要强系、实验或实训楼，还要有人牵头。成了是成果，败了人和钱都疼。"
      },
      apply: null
    };
  }

  function applyActionCopy(state, fallback) {
    if (!fallback) return fallback;
    var desc = fallback.desc;
    if (fallback.disabled && /不能申报|已满|已是/.test(fallback.name || "")) {
      return { name: fallback.name, desc: desc };
    }
    if ((state.tier || 0) <= 0) {
      return {
        name: fallback.name || "申报升本",
        desc: pickByState(state, {
          default: "评建办把两条升本路线摊开：普通本科还能往后冲，职业本科升完就到顶。材料齐不齐，先心里有数。",
          tight: "升本要花钱，账上却不算宽裕。评建办仍提醒：路线可以先想清楚，别等材料齐了才选。"
        })
      };
    }
    return { name: fallback.name, desc: desc };
  }

  function actionCopy(state, id, fallback) {
    if (id === "apply") {
      var a = applyActionCopy(state, fallback);
      return { name: (a && a.name) || (fallback && fallback.name) || "申报", desc: (a && a.desc) || (fallback && fallback.desc) || "" };
    }
    var pack = actionPack(state)[id];
    if (!pack) return { name: fallback.name, desc: fallback.desc };
    return { name: pack.name || fallback.name, desc: pack.desc || fallback.desc };
  }

  function greeting(state) {
    var season = seasonOf(state);
    var tight = fundsBand(state) === "tight";
    var gap = staffGap(state);
    if (season === "夏") {
      return {
        title: "校长，夏天好！",
        body: tight
          ? "校园热闹，账本也醒着。这一季先把人稳住，再谈铺得开的事。"
          : "蝉鸣和晚自习一起热起来了。这一季适合把人和队伍往前带一带。"
      };
    }
    if (season === "秋") {
      return {
        title: "校长，秋天好！",
        body: gap
          ? "银杏黄了，有的系却还缺带头人。收成季，先把师资和短板看仔细。"
          : "银杏道落叶扫了一层又一层。收成的季节，师资和账本都值得坐下来对一对。"
      };
    }
    if (season === "冬") {
      return {
        title: "校长，冬天好！",
        body: heatHigh(state)
          ? "天冷，办公室的茶却热。把柄还在桌上，先沉住气，把队伍稳住。"
          : "暖气刚热，校园安静了许多。沉住气，把队伍稳住，再迎下一春。"
      };
    }
    return {
      title: "校长，您好！",
      body: overCapacity(state)
        ? "新学期开始了，宿舍和食堂已经有点紧。先把眼前的事理顺，校园才转得开。"
        : "新学期开始了。教学楼前的人多了起来，先把校园打理起来吧。"
    };
  }

  function campusBlurb(state) {
    return actionPack(state).campus.desc;
  }

  function deptPickCopy(action, tier) {
    if (action === "build") {
      return {
        title: "建设名额给哪个系",
        body: "教务处说，每个系撬动的东西不一样：理学卡升格，计算机拉排名，经管出钱，医学太弱会被点名，文法会把舆论放大。系过了 60，同样名额加得少。"
      };
    }
    if (action === "project") {
      return {
        title: "课题挂在哪个系",
        body: "科技处提醒：这个系要够强，还要有实验楼或实训楼，以及一位能牵头的人。有可能失败，签字前想清楚。"
      };
    }
    var odds = tier <= 0
      ? "现在还是大专，简历里本校和普通学院出身会多一些，拉动也小一点。"
      : tier === 1
        ? "本科牌子在，普通大学博士会多起来，拉动比大专大。"
        : tier === 2
          ? "212 这一档，986 和海外博士开始常见，拉动更大。"
          : tier === 3
            ? "986 的门口，海外和 986 博士更常见。"
            : "D9 这一档，海外博士最常见，拉动也最大。";
    return {
      title: "新人落到哪个系",
      body: odds + "擅长科研抬学术，上课抬教学，国际抬国际影响，招生抬报考，学工抬风纪。"
    };
  }

  function gateCopy(kind) {
    if (kind === "used") {
      return { title: "这件事先搁下", body: "同一件事一年只办一次。办公室把文件夹退了回来，请校长先看别的。" };
    }
    if (kind === "funds") {
      return { title: "账上暂时盖不住", body: "财务处核对过了：这次开支账上还差一点。可以先去募捐，或换一件更急的事。" };
    }
    return { title: "先等等", body: "现在还不是动这件的时候。" };
  }

  function sectionCopy() {
    return {
      chronicleTitle: "校园备忘",
      chronicleMeta: "按年记下",
      tasksTitle: "待办事项",
      tasksMeta: "这一季",
      inquiryTitle: "今年过问",
      inquiryMeta: "不占本季",
      resultsTitle: "每年的结果",
      sceneEyebrow: "办公室来信",
      resultEyebrow: "事情有了下文"
    };
  }

  function resultFlavor(actionId, baseTitle, baseBody) {
    // 不改动结果里的数字句，只在标题上保留清晰感；正文保持引擎生成内容
    return { title: baseTitle, body: baseBody };
  }

  function schoolCopy(state) {
    var campus = state && state.campus;
    var pending = campus && campus.pending;
    var review = state && state.year % 2 === 0;
    var status = pickByState(state, {
      default: review
        ? "双年评审将近，档案室把办学层次和学科数字又对了一遍。"
        : "校园在转。档案室把现状摊在桌上，方便校长随时翻看。",
      tight: "账上不算宽裕。建设档案先把能做的、该缓的写清楚。",
      staff: "有的系还缺带头人，学科档案上留着空格。",
      crowd: "宿舍和食堂已经有点紧。容量写在档案里，后勤处希望校长看见。"
    });
    if (pending) {
      status = "工地还围着。后勤处说，上一座楼要等明年春天才能写进可用清单。";
    }
    return {
      tabs: { overview: "概况", build: "建设", depts: "学科" },
      overviewTitle: "校园发展档案",
      overviewLink: "实力一览 ›",
      buildTitle: "建设进度",
      buildMetaPending: function (name) { return "在建：" + name; },
      buildMetaIdle: "暂无在建",
      buildNoteEmpty: "教学楼和宿舍各有一座，校园的底子还在。",
      buildNoteBuilt: null,
      deptsTitle: "学科发展情况",
      heroStatus: status,
      pendingBanner: { title: "有一件事等你拍板", body: "先回办事页处理" }
    };
  }

  function peopleCopy(state) {
    var gap = staffGap(state);
    var mTotal = state && state.teachers ? state.teachers.length : 0;
    var motto = gap
      ? "有的系还缺人坐镇。人事处把空缺圈在名册上。"
      : mTotal < 6
        ? "队伍还薄。引进和稳住，比口号更要紧。"
        : pickByState(state, {
          default: "名册里的人撑着课堂和系里的日常。",
          heat: "把柄还在桌上。人事处提醒：考核和巡察会翻到同一页。",
          winter: "天冷，人却不能散。先把队伍稳住，再谈明年。"
        });
    return {
      motto: motto,
      tabs: { overview: "教师", hire: "招聘", train: "培养", assess: "考核" },
      statsTitle: "教职工档案",
      statsLink: function (n) { return "共 " + n + " 人"; },
      structureTitle: "队伍结构",
      structureMeta: "人事处统计",
      rosterTitle: "教师名册",
      filterLabel: "筛选",
      hireTitle: "人事处来信",
      hireMeta: "引进窗口",
      hireBody: function (oddsLine) {
        return oddsLine + " 花费清楚写在账上；先选系，再见面。出身和擅长会拉动不同方向，贪的来做副教授时，账也要一起看。";
      },
      hireCta: "开始招聘",
      trainTitle: "培养日常",
      trainMeta: "沿用教学评估",
      trainBody: function (focusLabel, costLabel) {
        return "没有单独的一对一培养指令。评建办现成的办法是「教学评估」：花费 " + costLabel + "，一年一次，这一季补" + (focusLabel || "教学") + "。职称晋升仍在双年评审里处理。";
      },
      trainCta: "去做教学评估",
      focusTitle: "优先关注",
      focusMeta: "才华偏低",
      focusEmpty: "名册还是空的。",
      chairPrefix: "当前带头人：",
      chairNone: "还没有学科带头人",
      assessTitle: "考核与评价",
      assessMeta: "按现有档案",
      assessNote: "档位沿用评审里的成果标准（才华 62 / 45）。同事之间也这样互相看着。",
      riskTitle: "需要盯住的人",
      riskMeta: "把柄 / 账洞 / 低忠诚",
      riskEmpty: "这一档没有明显考核风险。办公室的茶还热着。",
      emptyDept: "没有带头人，年底这个系会往下掉。",
      emptyFilter: "这一档现在没有人。",
      detailBack: "‹ 返回名册",
      detailNote: "出身与擅长会影响学校；把柄和账上的洞会在评审与巡察里露出来。培养走教学评估，晋升在双年评审里处理。"
    };
  }

  function applyCopy(state, ctx) {
    ctx = ctx || {};
    var mode = ctx.mode || "bachelor";
    var readyCount = ctx.readyCount || 0;
    var missing = ctx.missing || 0;
    var title = ctx.title || "";
    var prizeLines = ctx.prizeLines || [];

    if (mode === "bachelor") {
      return {
        eyebrow: readyCount > 0
          ? ("材料已齐 · 可递 " + readyCount + " 条路线")
          : "升本筹备 · 两条路线对照",
        title: "升本筹备",
        meta: readyCount > 0
          ? "评建办说，条件对得上了。剩下是选普通本科还是职业本科，以及这一笔申报经费。"
          : "评建办把两条升本路线摊开：普通本科还能往后冲，职业本科升完就到顶。缺口写在对照表里。",
        pathAcademicHint: function (cost) { return "经费 " + cost + " · 过了可续冲 212"; },
        pathVocationalHint: function (cost) { return "经费 " + cost + " · 升完封顶"; },
        pathGo: "看条件 ›",
        compareTitle: "评估专家对照意见",
        filterAll: "全部",
        filterOpen: "未达成",
        filterDone: "已达成",
        ctaReady: "选择升本路线",
        ctaGap: "查看升本缺口",
        statusDone: "已达成",
        statusProgress: "进行中",
        statusWarn: "待提升",
        statusLock: "未达成"
      };
    }

    if (mode === "master") {
      return {
        eyebrow: readyCount > 0
          ? ("材料已齐 · 可递 " + readyCount + " 个点")
          : "硕点筹备 · 职业本科路径",
        title: "专业硕士点",
        meta: readyCount > 0
          ? "研究生院说，有的点条件已经够得上。一次只能递一个，想清楚落在哪个系。"
          : "职业本科封顶之后，硕点是往上的台阶。最多两个点；办满三年才能正式递材料。",
        cardDoneMeta: "已经拿到。研究生院把批复收进档案。",
        cardOpenMeta: function (cost) { return "经费 " + cost + "。职业本科办满三年才能递。"; },
        fullReady: "两个点都在。整合去找政府；212 不会再收。",
        ctaReady: "申报专业硕士点",
        ctaGap: "查看硕点缺口"
      };
    }

    if (mode === "d9") {
      return {
        eyebrow: "申报中心",
        title: "D9",
        meta: "已经进了 D9。剩下的是榜单，还有把柄会不会炸。"
      };
    }

    // ladder: 212 / 986 / D9
    return {
      eyebrow: readyCount > 0
        ? ("材料已齐 · 可申报 " + title)
        : ("升档筹备 · 还差 " + missing + " 项"),
      title: title,
      meta: prizeLines.length
        ? ("过了：" + prizeLines.join("，") + "。省里按这一档送评，把柄数字不动。")
        : "省里按这一档送评。",
      cardMeta: function (cost) { return "经费 " + cost + "。把柄不动。"; },
      tipReady: function (lines) {
        return "已满足全部条件。过了：" + (lines || []).join("，") + "。评建办等校长签字。";
      },
      tipGap: function (n) { return "评估意见：还有 " + n + " 项没到，材料暂时递不出去。"; },
      tipShort: "财务处核对过了：经费不够，现在递不出去。",
      tipUsed: "今年已经递过一次。办公室把文件夹收了起来。",
      ctaReady: function (t) { return "申请" + t; },
      ctaGap: function (t) { return "查看" + t + "缺口"; },
      doneBadge: "完成"
    };
  }

  function pendingBannerCopy() {
    return { title: "有一件事等你拍板", body: "先回办事页处理" };
  }

  function recruitOddsCopy(tier) {
    if (tier <= 0) return "现在还是大专。人事处说，简历里本校和普通学院出身会多一些，拉动也小一点。";
    if (tier === 1) return "本科牌子在。普通大学博士会多起来，拉动比大专大。";
    if (tier === 2) return "212 这一档，986 和海外博士开始常见，拉动更大。";
    if (tier === 3) return "986 的门口，海外和 986 博士更常见。";
    return "D9 这一档，海外博士最常见，拉动也最大。";
  }

  global.CampusCopy = {
    actionCopy: actionCopy,
    greeting: greeting,
    campusBlurb: campusBlurb,
    deptPickCopy: deptPickCopy,
    gateCopy: gateCopy,
    sectionCopy: sectionCopy,
    resultFlavor: resultFlavor,
    schoolCopy: schoolCopy,
    peopleCopy: peopleCopy,
    applyCopy: applyCopy,
    pendingBannerCopy: pendingBannerCopy,
    recruitOddsCopy: recruitOddsCopy,
    /* 供文档与调试 */
    _debug: {
      fundsBand: fundsBand,
      staffGap: staffGap,
      heatHigh: heatHigh,
      overCapacity: overCapacity,
      seasonOf: seasonOf
    }
  };
})(typeof window !== "undefined" ? window : globalThis);
