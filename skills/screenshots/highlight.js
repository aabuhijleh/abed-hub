(el) => {
  const label = "LABEL";
  const before = BEFORE;
  const pad = 16;
  const ink = before ? "#ff8a6b" : "#5b5bf7";
  for (const n of document.querySelectorAll(".shot-mark")) n.remove();
  el.scrollIntoView({ block: "center", behavior: "instant" });
  const r = el.getBoundingClientRect();
  const mark = (css, text = "") => {
    const n = Object.assign(document.createElement("div"), {
      className: "shot-mark",
      textContent: text,
    });
    Object.assign(
      n.style,
      {
        position: "fixed",
        zIndex: "2147483647",
        pointerEvents: "none",
        boxSizing: "border-box",
      },
      css,
    );
    document.documentElement.append(n);
    return n;
  };
  const px = (box) =>
    Object.fromEntries(Object.entries(box).map(([k, v]) => [k, `${v}px`]));
  const ring = {
    left: r.left - 4,
    top: r.top - 4,
    width: r.width + 8,
    height: r.height + 8,
  };
  const content = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    if (!walker.currentNode.textContent.trim()) continue;
    const range = document.createRange();
    range.selectNodeContents(walker.currentNode);
    content.push(...range.getClientRects());
  }
  for (const n of document.body.querySelectorAll("*")) {
    const s = getComputedStyle(n);
    const drawn =
      n.matches("img, svg, canvas, video, input, select, textarea, progress") ||
      (n.childElementCount === 0 && s.backgroundColor !== "rgba(0, 0, 0, 0)");
    if (drawn && s.visibility !== "hidden") content.push(n.getBoundingClientRect());
  }
  mark({
    ...px(ring),
    border: `4px solid ${ink}`,
    boxShadow: "0 0 0 100vmax rgb(17 17 17 / 0.45)",
  });
  const tag = mark(
    {
      height: "22px",
      padding: "2px 8px",
      background: ink,
      color: before ? "#111" : "#fff",
      font: "700 13px/18px system-ui, sans-serif",
      whiteSpace: "nowrap",
    },
    label,
  );
  const w = tag.getBoundingClientRect().width;
  const h = 22;
  const right = ring.left + ring.width - w;
  const bottom = ring.top + ring.height;
  const spots = [
    { left: right, top: bottom - h },
    { left: ring.left, top: bottom - h },
    { left: right, top: ring.top },
    { left: ring.left, top: ring.top },
    { left: right, top: bottom },
    { left: ring.left, top: bottom },
    { left: right, top: ring.top - h },
    { left: ring.left, top: ring.top - h },
  ];
  const covered = (s) =>
    content.reduce((sum, b) => {
      const x = Math.min(s.left + w, b.right) - Math.max(s.left, b.left);
      const y = Math.min(s.top + h, b.bottom) - Math.max(s.top, b.top);
      return x > 0 && y > 0 ? sum + x * y : sum;
    }, 0);
  const spot = spots.reduce((best, s) => (covered(s) < covered(best) ? s : best));
  Object.assign(tag.style, px(spot));
  const top = Math.min(ring.top, spot.top);
  const end = Math.max(bottom, spot.top + h);
  mark(
    px({
      left: Math.max(ring.left - pad, 0),
      top: Math.max(top - pad, 0),
      width: ring.width + 2 * pad,
      height: end - top + 2 * pad,
    }),
  ).id = "shot-region";
}
