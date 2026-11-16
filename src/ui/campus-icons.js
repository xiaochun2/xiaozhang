/* Soft 3D campus icons from public/game-assets/assets/icons/campus */
(function (global) {
  "use strict";

  var DIR = "public/game-assets/assets/icons/campus/";

  /** Logical name → file basename (without .png) */
  var MAP = {
    home: "home",
    overview: "overview",
    back: "back",
    go: "go",
    build: "build",
    campus: "campus",
    school: "school",
    recruit: "recruit",
    teachers: "teachers",
    students: "students",
    world: "world",
    donate: "donate",
    heart: "heart",
    office: "office",
    tasks: "tasks",
    gov: "gov",
    inspect: "inspect",
    search: "search",
    teach: "teach",
    education: "education",
    cap: "cap",
    apply: "apply",
    score: "score",
    star: "star",
    coin: "coin",
    funds: "funds",
    shield: "shield",
    book: "book",
    train: "train",
    voice: "voice",
    mail: "mail",
    filter: "filter",
    assess: "assess",
    growth: "growth",
    calendar: "calendar",
    notice: "notice",
    settings: "settings",
    reward: "reward",
    ok: "ok",
    warn: "warn",
    error: "error",
    help: "help",
    more: "more",
    play: "play",
    pause: "pause",
    wait: "wait",
    /* Lucide-era aliases → campus assets */
    users: "teachers",
    "graduation-cap": "education",
    "chart-no-axes-combined": "growth",
    "chevron-right": "go",
    "chevron-left": "back"
  };

  function srcFor(name) {
    var file = MAP[name] || MAP.home;
    return DIR + file + ".png";
  }

  function icon(name, opts) {
    opts = opts || {};
    var cls = "campus-ico campus-ico--" + (MAP[name] || name || "home");
    if (opts.tone) cls += " campus-ico--" + opts.tone;
    if (opts.className) cls += " " + opts.className;
    var size = opts.size || 24;
    return (
      '<img class="' +
      cls +
      '" src="' +
      srcFor(name) +
      '" width="' +
      size +
      '" height="' +
      size +
      '" alt="" draggable="false" loading="lazy" />'
    );
  }

  global.CampusIcons = {
    icon: icon,
    src: srcFor,
    map: MAP,
    assetDir: DIR
  };
})(typeof window !== "undefined" ? window : globalThis);
