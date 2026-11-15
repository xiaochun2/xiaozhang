/**
 * 校园经营游戏素材注册表（对应 docs/asset-manifest.json）
 * 实际文件位于 public/game-assets/assets/
 */
(function (root) {
  // 仓库根目录部署：index.html 在根，素材在 public/game-assets/assets/
  const BASE = "public/game-assets/assets";

  function url(rel) {
    return BASE + "/" + String(rel).replace(/^assets\//, "");
  }

  const buildings = {
    academic: url("buildings/academic.png"),
    administration: url("buildings/administration.png"),
    "arts-center": url("buildings/arts-center.png"),
    auditorium: url("buildings/auditorium.png"),
    "campus-gate": url("buildings/campus-gate.png"),
    dining: url("buildings/dining.png"),
    dormitory: url("buildings/dormitory.png"),
    greenhouse: url("buildings/greenhouse.png"),
    gymnasium: url("buildings/gymnasium.png"),
    innovation: url("buildings/innovation.png"),
    "international-center": url("buildings/international-center.png"),
    library: url("buildings/library.png"),
    medical: url("buildings/medical.png"),
    science: url("buildings/science.png"),
    stadium: url("buildings/stadium.png"),
    "student-activity": url("buildings/student-activity.png")
  };

  const characters = {
    "administrator-female": url("characters/administrator-female.png"),
    "coach-male": url("characters/coach-male.png"),
    "librarian-female": url("characters/librarian-female.png"),
    "principal-male": url("characters/principal-male.png"),
    "professor-male": url("characters/professor-male.png"),
    "staff-female": url("characters/staff-female.png"),
    "student-female-01": url("characters/student-female-01.png"),
    "student-female-02": url("characters/student-female-02.png"),
    "student-male-01": url("characters/student-male-01.png"),
    "student-male-02": url("characters/student-male-02.png"),
    "teacher-female": url("characters/teacher-female.png"),
    "teacher-male": url("characters/teacher-male.png")
  };

  const atlases = {
    icons: url("icons/01_game_icons_atlas.png"),
    ui: url("ui/02_ui_components_atlas.png"),
    dialogs: url("ui/07_dialogs_atlas.png"),
    props: url("props/03_props_atlas.png"),
    map: url("map/05_map_tiles_atlas.png"),
    scenery: url("decorations/04_scenery_atlas.png"),
    effects: url("effects/06_effects_atlas.png"),
    badges: url("badges/08_achievement_badges_atlas.png")
  };

  /** 游戏内建筑 id → 独立建筑 PNG */
  const buildingByGameId = {
    teach: "academic",
    dorm: "dormitory",
    train: "student-activity",
    lab: "science",
    lib: "library",
    industry: "innovation",
    gym: "gymnasium",
    intl: "international-center",
    hospital: "medical",
    admin: "administration"
  };

  const facultyPool = {
    3: ["professor-male", "teacher-female", "librarian-female"],
    2: ["teacher-male", "teacher-female", "administrator-female"],
    1: ["teacher-male", "staff-female", "coach-male"],
    0: ["staff-female", "teacher-male", "librarian-female"]
  };

  function hash(str) {
    let h = 0;
    const s = String(str || "");
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return h;
  }

  function buildingSrc(gameId) {
    const key = buildingByGameId[gameId];
    return key ? buildings[key] : null;
  }

  function characterSrc(id) {
    return characters[id] || null;
  }

  function teacherSrc(teacher) {
    const rank = Math.max(0, Math.min(3, teacher && teacher.rank != null ? teacher.rank : 1));
    const pool = facultyPool[rank] || facultyPool[1];
    const pick = pool[hash(teacher && teacher.id) % pool.length];
    return characters[pick];
  }

  root.GameAssets = {
    BASE: BASE,
    url: url,
    buildings: buildings,
    characters: characters,
    atlases: atlases,
    buildingByGameId: buildingByGameId,
    buildingSrc: buildingSrc,
    characterSrc: characterSrc,
    teacherSrc: teacherSrc,
    missing: []
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
