(el) => {
  const label = "LABEL";
  const before = BEFORE;
  const empty = "EMPTY";
  const pad = 16;
  const h = 22;
  const ink = before ? "#ff8a6b" : "#5b5bf7";
  const anchor = el.matches(".shot-empty") ? el.nextElementSibling : el;
  for (const n of document.querySelectorAll(".shot-mark, .shot-empty")) n.remove();
  const target = empty ? emptySlot(anchor, empty) : anchor;
  target.scrollIntoView({ block: "center", behavior: "instant" });
  const r = target.getBoundingClientRect();
  function emptySlot(next, text) {
    const row = next.tagName === "TR";
    const slot = document.createElement(row ? "tr" : "div");
    slot.className = "shot-empty";
    const cell = row
      ? slot.appendChild(
          Object.assign(document.createElement("td"), {
            colSpan: [...next.cells].reduce((n, c) => n + c.colSpan, 0),
          }),
        )
      : slot;
    cell.textContent = text;
    Object.assign(cell.style, {
      height: `${next.getBoundingClientRect().height}px`,
      boxSizing: "border-box",
      padding: "0 16px",
      textAlign: "center",
      verticalAlign: "middle",
      color: "#555",
      font: "italic 600 14px system-ui, sans-serif",
      background: "repeating-linear-gradient(45deg, #fff 0 8px, #eee 8px 16px)",
      outline: "2px dashed #999",
      outlineOffset: "-6px",
    });
    if (!row) Object.assign(cell.style, { display: "grid", placeItems: "center" });
    next.before(slot);
    return slot;
  }
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
      top: `${ring.top + ring.height}px`,
      height: `${h}px`,
      padding: "2px 8px",
      background: ink,
      color: before ? "#111" : "#fff",
      font: "700 13px/18px system-ui, sans-serif",
      whiteSpace: "nowrap",
    },
    label,
  );
  mark(
    px({
      left: Math.max(ring.left - pad, 0),
      top: Math.max(ring.top - pad, 0),
      width: ring.width + 2 * pad,
      height: ring.height + h + 2 * pad,
    }),
  ).id = "shot-region";
}
