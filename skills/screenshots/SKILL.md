---
name: screenshots
description: >-
  Make an evidence image: highlight the changed element, crop to it, and frame it with a
  caption and before/after labels. Use for a screenshot, an evidence image, a before/after,
  or an image attachment for a PR, Slack message or Jira ticket.
license: MIT
allowed-tools: Bash(playwright-cli:*), Bash(gh-attach shot:*), Bash(printf:*), Bash(cat:*)
---

# Screenshots

This skill makes the image that fills a PR's Evidence section, or goes with a Slack message
or Jira ticket. The PR's headings and prose come from `/pr` or the repo's template. This
skill writes only the image.

## When to shoot

`/pr` makes the call: a screenshot when the change is visible in a running UI, test or
command output otherwise. Follow it. An image the user handed you goes out as it is.

Every image you make:

- **One idea.** One changed element, or one before/after pair of it.
- **Highlighted.** A ring and a short label on the changed element, the rest dimmed.
- **Cropped.** The changed element and a little context, never the full page.
- **Captioned.** A title and one line on the image itself, saying what it shows.
- **Labelled.** Before and after, side by side or stacked.
- **The app's default theme.** Light unless the app ships dark by default. When the app
  follows the system, set it: `playwright-cli -s=shots set-color-scheme light`.
- **Sized for where it lands.** 948px wide for GitHub, 1200px for Slack.

## 1. Open the page at 2x

The default session is 1x, which blurs once the frame scales the crop. Open a named session
with a 2x config:

```bash
printf '{ "browser": { "contextOptions": { "deviceScaleFactor": 2, "viewport": { "width": 1280, "height": 900 } } } }\n' > /tmp/shots.config.json
playwright-cli -s=shots open --config=/tmp/shots.config.json <url>
playwright-cli -s=shots --raw eval "() => location.href"
```

The `eval` must print the URL you opened. Then drive the app to the changed state; call the
Skill tool with `playwright-cli` for the commands. For a before/after pair, shoot the same
selector, viewport and theme twice: the base state first (the default branch, or what is
deployed), then the branch.

## 2. Highlight and crop

Write the snippet with `LABEL` replaced by a few words naming the change ("New: config
command", "Uploader now set"):

```bash
cat > /tmp/highlight.js <<'EOF'
el => {
  const label = "LABEL";
  const pad = 24;
  document.querySelectorAll(".shot-mark").forEach((n) => n.remove());
  el.scrollIntoView({ block: "center", behavior: "instant" });
  const r = el.getBoundingClientRect();
  const mark = (css, text = "") => {
    const n = Object.assign(document.createElement("div"), { className: "shot-mark", textContent: text });
    Object.assign(n.style, { position: "fixed", zIndex: "2147483647", pointerEvents: "none", boxSizing: "border-box" }, css);
    document.documentElement.append(n);
    return n;
  };
  const ring = { left: r.left - 4, top: r.top - 4, width: r.width + 8, height: r.height + 8 };
  const px = (box) => Object.fromEntries(Object.entries(box).map(([k, v]) => [k, `${v}px`]));
  mark({ ...px(ring), border: "3px solid #e5484d", borderRadius: "6px", boxShadow: "0 0 0 100vmax rgb(0 0 0 / 0.35)" });
  mark({ ...px({ left: ring.left, top: ring.top - 24 }), height: "24px", padding: "2px 8px", borderRadius: "4px 4px 0 0",
    background: "#e5484d", color: "#fff", font: "600 13px/20px system-ui, sans-serif" }, label);
  mark(px({ left: Math.max(ring.left - pad, 0), top: Math.max(ring.top - 24 - pad, 0),
    width: ring.width + 2 * pad, height: ring.height + 24 + 2 * pad })).id = "shot-region";
}
EOF
playwright-cli -s=shots eval "$(cat /tmp/highlight.js)" "<selector>"
playwright-cli -s=shots screenshot "#shot-region" --hires --filename=/abs/path/after.png
```

`<selector>` is a snapshot ref (`e12`) or a selector that matches one element
(`table tr:nth-child(3) td.uploader`, `.markdown-body pre >> nth=0`). Pick the smallest
element that changed: the cell, not the table. The snippet adds a transparent
`#shot-region` box around the ring, so the screenshot is the element plus `pad` pixels of
context. Raise `pad` for more context. Run the snippet again after any navigation or
re-render, since the marks go with the old DOM.

## 3. Frame

Write the frame next to the PNGs, fill in the title and caption, and render it:

```html
<!doctype html>
<meta charset="utf-8">
<style>
  html { background: #ffffff; color: #1f2328; }
  html.dark { background: #0d1117; color: #e6edf3; }
  body { margin: 24px; font: 14px/1.5 -apple-system, "Segoe UI", system-ui, sans-serif; }
  h1 { margin: 0 0 4px; font-size: 18px; }
  .caption { margin: 0 0 16px; opacity: 0.75; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .grid.stacked { grid-template-columns: 1fr; }
  figure { margin: 0; border: 1px solid #d1d9e0; border-radius: 8px; overflow: hidden; }
  .dark figure { border-color: #3d444d; }
  figcaption { padding: 6px 12px; font-weight: 600; border-bottom: inherit; }
  .before figcaption { color: #cf222e; }
  .after figcaption { color: #1a7f37; }
  img { display: block; width: 100%; }
</style>
<h1>TITLE: what changed, in the reader's words</h1>
<p class="caption">CAPTION: where it is, and what to look at.</p>
<div class="grid stacked">
  <figure class="before"><figcaption>Before</figcaption><img src="before.png" alt="Before"></figure>
  <figure class="after"><figcaption>After</figcaption><img src="after.png" alt="After"></figure>
</div>
```

```bash
gh-attach shot /abs/path/frame.html /abs/path/evidence.png --width 948
```

- `stacked` puts after under before, which suits a crop wider than it is tall. Drop the
  class for side by side.
- A single image keeps one `figure` and drops its `figcaption`.
- `class="dark"` on `<html>` when the app's default theme is dark.
- `--width 1200` for Slack.

## 4. Look before posting

Read every PNG you made, the crops and the framed image, with the Read tool. Post it only
when all of these hold:

- It shows the page you meant, not a blank or `about:blank` frame.
- The ring sits on the changed element.
- The title, caption, label and Before/After text are readable at the posted width.
- Before and after differ where the label says they do.

Anything else, fix the selector, state or frame and shoot again.

## playwright-cli traps

- It blocks `file:` URLs, so a local HTML page goes through `gh-attach shot`, which reads
  files and URLs.
- A screenshot of a page that never loaded saves `about:blank` and exits 0. The URL check
  in step 1 catches it.
- A page with smooth scrolling moves after the snippet measures, and the ring lands off
  the element. The snippet scrolls with `behavior: "instant"` for this reason; keep it.
- The marks are `position: fixed`, so the region has to fit in the viewport. For a taller
  element, `playwright-cli -s=shots resize 1280 1600` and run the snippet again.
- `playwright-cli -s=shots close` when done. A session left open keeps the browser running.

## Hand off

GitHub: call the Skill tool with `gh-attach` and put the framed PNG in the PR description
under `## Evidence`. Slack or Jira: hand the PNG to whatever posts the message.

## Requirements

`playwright-cli`, a chromium build and `gh-attach`, all installed by the abed-hub
`gh-attach` component. When one is missing, call the Skill tool with `abed-hub` and repair
the `gh-attach` component.
