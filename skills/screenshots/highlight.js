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
  mark({
    ...px(ring),
    border: `4px solid ${ink}`,
    boxShadow: "0 0 0 100vmax rgb(17 17 17 / 0.45)",
  });
  mark(
    {
      right: `${document.documentElement.clientWidth - ring.left - ring.width}px`,
      top: `${ring.top + ring.height - 22}px`,
      height: "22px",
      padding: "2px 8px",
      background: ink,
      color: before ? "#111" : "#fff",
      font: "700 13px/18px system-ui, sans-serif",
    },
    label,
  );
  mark(
    px({
      left: Math.max(ring.left - pad, 0),
      top: Math.max(ring.top - pad, 0),
      width: ring.width + 2 * pad,
      height: ring.height + 2 * pad,
    }),
  ).id = "shot-region";
}
