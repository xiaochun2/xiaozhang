/* Campus UI factories — vanilla HTML strings, no framework */
(function (global) {
  "use strict";

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function attrs(map) {
    if (!map) return "";
    return Object.keys(map).map(function (key) {
      const val = map[key];
      if (val == null || val === false) return "";
      if (val === true) return " " + key;
      return " " + key + '="' + esc(val) + '"';
    }).join("");
  }

  function cx() {
    const out = [];
    for (let i = 0; i < arguments.length; i++) {
      const v = arguments[i];
      if (!v) continue;
      if (typeof v === "string") out.push(v);
    }
    return out.join(" ");
  }

  function button(opts) {
    opts = opts || {};
    const variant = opts.variant || "secondary";
    const cls = cx(
      "campus-btn",
      "campus-btn--" + variant,
      opts.block || variant === "primary" || variant === "accent" ? "campus-btn--block" : "",
      opts.className
    );
    const cost = opts.cost != null && opts.cost !== "" ? "<em>" + esc(opts.cost) + "</em>" : "";
    return "<button type=\"button\" class=\"" + cls + "\"" + attrs(opts.attrs) +
      (opts.disabled ? " disabled" : "") + ">" +
      (opts.html || esc(opts.label || "")) + cost + "</button>";
  }

  function card(opts) {
    opts = opts || {};
    const tone = opts.tone ? " campus-card--" + opts.tone : "";
    const head = opts.title
      ? '<div class="campus-card__head"><h2>' + esc(opts.title) + "</h2>" +
        (opts.meta ? '<span class="meta">' + esc(opts.meta) + "</span>" : "") + "</div>"
      : "";
    return '<section class="campus-card card' + tone + (opts.className ? " " + opts.className : "") + '">' +
      head + (opts.body || "") + "</section>";
  }

  function badge(opts) {
    opts = opts || {};
    const tone = opts.tone ? " campus-badge--" + opts.tone : "";
    return '<span class="campus-badge tag' + tone + (opts.tone === "warn" ? " warn" : "") + '">' +
      esc(opts.label || "") + "</span>";
  }

  function progress(opts) {
    opts = opts || {};
    const pct = Math.max(0, Math.min(100, Number(opts.pct) || 0));
    const tone = opts.tone ? " is-" + opts.tone : (opts.toneClass ? " " + opts.toneClass : "");
    const fillClass = opts.tone ? opts.tone : (opts.toneClass || "");
    return '<div class="campus-progress' + (opts.className ? " " + opts.className : "") + '">' +
      '<div class="campus-progress__row"><b>' + esc(opts.label || "") + "</b><span>" +
      esc(opts.shown != null ? opts.shown : "") + "</span></div>" +
      '<div class="campus-progress__track track"><i class="campus-progress__fill' +
      (fillClass ? " " + fillClass : "") + tone + '" style="width:' + pct.toFixed(1) + '%"></i></div></div>';
  }

  function statCard(opts) {
    opts = opts || {};
    const tone = opts.tone ? " is-" + opts.tone : "";
    return '<div class="campus-stat stat-card' + tone + (opts.tone ? " " + opts.tone : "") + '">' +
      '<span class="pico">' + (opts.iconHtml || "") + "</span><b>" + esc(opts.value) +
      "</b><em>" + esc(opts.label) + "</em></div>";
  }

  function resourceBar(items) {
    items = items || [];
    return '<div class="campus-resource top-meta">' + items.map(function (it) {
      return '<span class="campus-resource__chip chip' + (it.tone ? " is-" + it.tone + " " + it.tone : "") + '">' +
        (it.iconHtml || "") + esc(it.value) + "</span>";
    }).join("") + "</div>";
  }

  function bottomNav(opts) {
    opts = opts || {};
    const items = opts.items || [];
    return '<nav class="campus-nav tabs">' + items.map(function (item) {
      const on = item.id === opts.active;
      return '<button type="button" class="campus-nav__item' + (on ? " is-on on" : "") +
        '" data-act="tab" data-arg="' + esc(item.id) + '">' +
        (item.iconHtml || "") + "<span>" + esc(item.label) + "</span></button>";
    }).join("") + "</nav>";
  }

  function taskCard(opts) {
    opts = opts || {};
    return '<article class="campus-task task-card' + (opts.disabled ? " is-off off" : "") + '">' +
      '<span class="campus-task__ico ico">' + (opts.iconHtml || "") + "</span>" +
      '<div class="campus-task__body actxt"><b>' + esc(opts.name) + "</b><small>" + esc(opts.desc) + "</small>" +
      (opts.costHtml || "") + "</div>" +
      '<button type="button" class="campus-task__go task-go" data-act="action" data-arg="' + esc(opts.id) + '"' +
      (opts.disabled ? " disabled" : "") + ">" + esc(opts.cta || "去处理") + "</button></article>";
  }

  function teacherCard(opts) {
    opts = opts || {};
    const tag = opts.clickable ? "button" : "article";
    const type = opts.clickable ? ' type="button"' : "";
    const extra = attrs(opts.attrs);
    return "<" + tag + type + ' class="campus-teacher person' + (opts.clickable ? " is-clickable" : "") + '"' + extra + ">" +
      '<span class="campus-teacher__avatar avatar">' + (opts.avatarHtml || esc(opts.initial || "?")) + "</span>" +
      '<div class="campus-teacher__who who"><div class="campus-teacher__name nameline"><b>' + esc(opts.name) + "</b>" +
      (opts.badgesHtml || "") + '</div>' +
      (opts.meta ? '<div class="campus-teacher__meta meta">' + esc(opts.meta) + "</div>" : "") +
      (opts.metaHtml || "") +
      (opts.statsHtml || "") +
      "</div>" +
      (opts.trailHtml || (opts.clickable ? '<span class="campus-teacher__go" aria-hidden="true">›</span>' : "")) +
      "</" + tag + ">";
  }

  function eventCard(opts) {
    opts = opts || {};
    return '<section class="campus-event event-card">' +
      '<div class="campus-event__visual event-visual">' + (opts.visualHtml || "") + "</div>" +
      '<div class="campus-event__body event-body">' + (opts.bodyHtml || "") + "</div></section>";
  }

  function tabs(opts) {
    opts = opts || {};
    return '<div class="campus-tabs seg-tabs">' + (opts.items || []).map(function (item) {
      const on = item.id === opts.active;
      return '<button type="button" class="campus-tabs__item' + (on ? " is-on on" : "") +
        '" data-act="' + esc(opts.act || "tab") + '" data-arg="' + esc(item.id) + '">' +
        esc(item.label) + "</button>";
    }).join("") + "</div>";
  }

  function buildingCard(opts) {
    opts = opts || {};
    return '<figure class="campus-building campus-item">' + (opts.artHtml || "") +
      "<figcaption><b>" + esc(opts.name) + "</b><em>" + esc(opts.meta || "") + "</em></figcaption></figure>";
  }

  function goalHead(opts) {
    opts = opts || {};
    return '<div class="campus-goal sumtop"><div><h2>' + esc(opts.title || "") + "</h2>" +
      '<p class="meta">' + esc(opts.meta || "") + "</p></div>" + (opts.ringHtml || "") + "</div>";
  }

  global.CampusUI = {
    esc: esc,
    button: button,
    card: card,
    badge: badge,
    progress: progress,
    statCard: statCard,
    resourceBar: resourceBar,
    bottomNav: bottomNav,
    taskCard: taskCard,
    teacherCard: teacherCard,
    eventCard: eventCard,
    tabs: tabs,
    buildingCard: buildingCard,
    goalHead: goalHead
  };
})(typeof window !== "undefined" ? window : globalThis);
