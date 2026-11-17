/* Lucide icon materials (backup). Path: public/game-assets/assets/icons/lucide */
(function (global) {
  "use strict";

  var INNER = {
    "chart-no-axes-combined":
      '<path d="M12 16v5"/><path d="M16 14v7"/><path d="M20 10v11"/><path d="m22 3-8.646 8.646a.5.5 0 0 1-.708 0L9.354 8.354a.5.5 0 0 0-.707 0L2 15"/><path d="M4 18v3"/><path d="M8 14v7"/>',
    "chevron-left": '<path d="m15 18-6-6 6-6"/>',
    "chevron-right": '<path d="m9 18 6-6-6-6"/>',
    filter: '<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>',
    "graduation-cap":
      '<path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z"/><path d="M22 10v6"/><path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5"/>',
    search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
    star:
      '<path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z"/>',
    users:
      '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>'
  };

  function lucideIcon(name, opts) {
    opts = opts || {};
    var body = INNER[name] || INNER.users;
    var tone = opts.tone ? " lucide--" + opts.tone : "";
    var fill = opts.filled ? ' fill="currentColor"' : ' fill="none"';
    var cls = "lucide lucide-" + name + tone + (opts.className ? " " + opts.className : "");
    return (
      '<svg class="' +
      cls +
      '" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"' +
      fill +
      ' stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      body +
      "</svg>"
    );
  }

  function gameIcon(name) {
    if (name === "coin") {
      return '<img class="game-ico game-ico--coin" src="public/game-assets/assets/icons/game/coin.svg" width="18" height="18" alt="" draggable="false" />';
    }
    return "";
  }

  global.CampusLucide = {
    icon: lucideIcon,
    gameIcon: gameIcon,
    names: Object.keys(INNER),
    assetDir: "public/game-assets/assets/icons/lucide/"
  };
})(typeof window !== "undefined" ? window : globalThis);
