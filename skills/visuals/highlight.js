(el) => {
  const label = "LABEL";
  const before = BEFORE;
  const empty = "EMPTY";
  const add = ADD;
  const pad = 16;
  const h = 22;
  const ink = before ? "#ff8a6b" : "#5b5bf7";
  let doc;
  try {
    doc = top.document;
  } catch {
    throw new Error("The element sits in a cross-origin frame. Open the frame's URL and ring it there.");
  }
  const anchor = el.matches(".shot-empty") ? el.nextElementSibling : el;
  if (!add || !top.shotRings) {
    for (const ring of top.shotRings ?? []) {
      if (ring.target.matches(".shot-empty")) ring.target.remove();
    }
    top.shotRings = [];
  }
  const target = empty ? emptySlot(anchor, empty) : anchor;
  const box = target.getBoundingClientRect();
  const view = target.ownerDocument.defaultView;
  if (!add || box.top < 0 || box.bottom + h + pad > view.innerHeight) {
    target.scrollIntoView({ block: "center", behavior: "instant" });
  }
  top.shotRings.push({ target, label, ink, text: before ? "#111" : "#fff" });
  for (const n of doc.querySelectorAll(".shot-mark")) n.remove();
  const inTop = (node) => {
    const box = node.getBoundingClientRect();
    let [x, y] = [box.left, box.top];
    for (let w = node.ownerDocument.defaultView; w !== top; w = w.parent) {
      const frame = w.frameElement;
      const f = frame.getBoundingClientRect();
      x += f.left + frame.clientLeft;
      y += f.top + frame.clientTop;
    }
    return { left: x, top: y, width: box.width, height: box.height };
  };
  function emptySlot(next, text) {
    const box = next.getBoundingClientRect();
    const css = getComputedStyle(next);
    const row = next.tagName === "TR";
    const kept = row || ["TD", "TH", "LI"].includes(next.tagName);
    const slot = next.ownerDocument.createElement(kept ? next.tagName : "div");
    slot.className = "shot-empty";
    const cell = row
      ? slot.appendChild(
          Object.assign(next.ownerDocument.createElement("td"), {
            colSpan: [...next.cells].reduce((n, c) => n + c.colSpan, 0),
          }),
        )
      : slot;
    cell.textContent = text;
    Object.assign(cell.style, {
      height: `${box.height}px`,
      boxSizing: "border-box",
      padding: box.height < 28 ? "0 6px" : "0 16px",
      overflow: "hidden",
      whiteSpace: "nowrap",
      textAlign: "center",
      verticalAlign: "middle",
      color: "#555",
      font: `italic 600 ${Math.min(14, box.height - 6)}px/${box.height}px system-ui, sans-serif`,
      background: "repeating-linear-gradient(45deg, #fff 0 8px, #eee 8px 16px)",
      outline: "2px dashed #999",
      outlineOffset: box.height < 28 ? "-2px" : "-6px",
    });
    if (!row) {
      Object.assign(slot.style, { minWidth: `${box.width}px`, margin: css.margin });
    }
    if (!kept) {
      const inline = css.display.startsWith("inline");
      slot.style.display = inline ? "inline-block" : "block";
    }
    next.before(slot);
    return slot;
  }
  const mark = (css, text = "") => {
    const n = Object.assign(doc.createElement("div"), {
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
    doc.documentElement.append(n);
    return n;
  };
  const px = (box) =>
    Object.fromEntries(Object.entries(box).map(([k, v]) => [k, `${v}px`]));
  const width = doc.documentElement.clientWidth;
  const height = doc.documentElement.clientHeight;
  const drawn = top.shotRings.map((s) => {
    const r = inTop(s.target);
    const ring = {
      left: r.left - 4,
      top: r.top - 4,
      width: r.width + 8,
      height: r.height + 8,
    };
    mark({ ...px(ring), border: `4px solid ${s.ink}` });
    const tag = mark(
      {
        right: `${width - ring.left - ring.width}px`,
        top: `${ring.top + ring.height + h > height ? ring.top - h : ring.top + ring.height}px`,
        height: `${h}px`,
        padding: "2px 8px",
        background: s.ink,
        color: s.text,
        font: "700 13px/18px system-ui, sans-serif",
        whiteSpace: "nowrap",
      },
      s.label,
    ).getBoundingClientRect();
    return { ring, tag };
  });
  const holes = drawn
    .map(({ ring: { left: l, top: t, width: w, height: d } }) => `M${l} ${t}h${w}v${d}h${-w}Z`)
    .join("");
  mark({
    inset: "0",
    zIndex: "2147483646",
    background: "rgb(17 17 17 / 0.45)",
    clipPath: `path(evenodd, "M0 0H${width}V${height}H0Z${holes}")`,
  });
  const edges = drawn.flatMap(({ ring, tag }) => [
    [ring.left, ring.top, ring.left + ring.width, ring.top + ring.height],
    [tag.left, tag.top, tag.right, tag.bottom],
  ]);
  const left = Math.max(Math.min(...edges.map((e) => e[0])) - pad, 0);
  const topEdge = Math.max(Math.min(...edges.map((e) => e[1])) - pad, 0);
  const right = Math.min(Math.max(...edges.map((e) => e[2])) + pad, width);
  const bottom = Math.min(Math.max(...edges.map((e) => e[3])) + pad, height);
  mark(px({ left, top: topEdge, width: right - left, height: bottom - topEdge })).id =
    "shot-region";
}
