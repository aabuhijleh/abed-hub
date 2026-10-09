# Screenshots

Three shapes: a plain crop, a crop with a ring on the point, and a pin on an image you
already have. Each ends as an `<img>` inside the frame from SKILL.md step 3.

## Open the page at 2x

The default session is 1x, which blurs once the frame scales the crop. Open a named session
with a 2x config, in the app's default theme (`playwright-cli -s=shots set-color-scheme
light` when it follows the system):

```bash
printf '{ "browser": { "contextOptions": { "deviceScaleFactor": 2, "viewport": { "width": 1280, "height": 900 } } } }\n' > /tmp/shots.config.json
playwright-cli -s=shots open --config=/tmp/shots.config.json <url>
playwright-cli -s=shots --raw eval "() => location.href"
```

The `eval` must print the URL you opened. Then drive the app to the state the claim is
about; call the Skill tool with `playwright-cli` for the commands. For a before/after pair,
shoot the same selector, viewport and theme twice: the base state first (the default
branch, or what is deployed), then the branch.

When there is no running app, or the state is hard to reach, start the dev server, or
write the page as HTML with mock data in the job folder and serve it, since
`playwright-cli` refuses `file:` URLs:

```bash
cd /tmp/visuals/<slug> && python3 -m http.server 8765   # run in the background
playwright-cli -s=shots open --config=/tmp/shots.config.json http://localhost:8765/mock.html
```

## Crop

Crop to the smallest element that holds the claim and names it: the row when the claim
names a record ("ABC-120 now waits for payment"), the cell when the row is already clear.
When that crop holds only the claim, shoot it plain:

```bash
playwright-cli -s=shots screenshot "<selector>" --hires --filename=/tmp/visuals/<slug>/after.png
```

## Ring

When the claim sits in a larger view the reader needs, ring it with
[`highlight.js`](highlight.js) from this skill's folder. It rings the element, darkens the
rest, and hangs a label under the ring's bottom-right corner. Set `BEFORE` to `true` for a
before shot, which rings in coral:

```bash
sed -e 's/LABEL/Declined, now waits for payment/' -e 's/BEFORE/false/' -e 's/EMPTY//' <skill-dir>/highlight.js > /tmp/highlight.js
playwright-cli -s=shots eval "$(cat /tmp/highlight.js)" "<selector>"
playwright-cli -s=shots screenshot "#shot-region" --hires --filename=/tmp/visuals/<slug>/after.png
```

When the claim is that something no longer appears, the after shot rings an empty slot
where it was. Set `EMPTY` to a few words for it ("Not created") and point `<selector>` at
the element now in its place.

`<selector>` is a snapshot ref (`e12`) or a selector that matches one element
(`table tr:nth-child(3)`). The region is the element plus 16px. Raise `pad` in the script
for more context. Run it again after any navigation or re-render, since the marks go with
the old DOM.

## Pin: an image you already have

An image the user sent goes back with the point ringed. Put it in a `.pin` and place a
`<b>` ring with `--x --y --w --h` in percent of the image. The label hangs under the ring;
`class="up"` hangs it above, `class="right"` beside it:

```html
<h1>Only ABC-120 is still awaiting payment</h1>
<div class="panel"><div class="pin"><img src="orders.png" alt="Orders page">
  <b class="right" style="--x:53%;--y:66.3%;--w:12.5%;--h:8.6%"><span>The only one not paid</span></b>
</div></div>
```

`magick identify orders.png` gives the pixel size. Divide the target's box by it for the
percentages. The first render is usually a few percent off, so nudge and render again.

## In the frame

```html
<div class="panel">
  <div class="side after"><img class="shot" src="after.png" alt="ABC-120 shows Awaiting payment"></div>
</div>
```

For a change, one `.side before` and one `.side after`, each with its `.tag` and `img`.
Use `class="panel pair"` for two crops narrower than they are wide.

## The product's icons

When an image names a UI state the product marks with an icon (a tick, a status badge, a
"?"), it draws that icon wherever it names the state, so the reader matches the image to
the screen.

1. Find the component that draws the state: search the UI code for the state's label,
   `aria-label` or tooltip.
2. Copy the icon. For an icon library, take the path data from the installed package
   (lucide-react: `dist/esm/icons/<name>.mjs`, under `node_modules` or the bun cache) into
   an `<svg viewBox="0 0 24 24">`. A glyph the component draws as text stays text.
3. Copy its colour into `--c`: follow the class (`text-success`) to its variable in the
   app's theme CSS. Add `pill` when the component draws a bordered badge.

```html
<span class="icon" style="--c:oklch(0.55 0.16 163)"><svg viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg></span>
<span class="icon pill" style="--c:oklch(0.58 0.22 27)"><svg viewBox="0 0 24 24"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>25.0</span>
<span class="icon pill" style="--c:oklch(0.52 0.13 65)">?</span>
```

`.icon svg` draws lucide's 2px round stroke. A filled icon set takes
`style="fill:currentColor;stroke:none"` on the `svg`. When the product has no icon for the
state, or its source is out of reach, use the nearest emoji (✅ ❌ ❓ ⚠️). Mermaid and
Vega-Lite labels take the emoji too, since they can't hold the `svg`.

## playwright-cli traps

- A screenshot of a page that never loaded saves `about:blank` and exits 0. The URL check
  above catches it.
- The marks are `position: fixed`, so the region has to fit in the viewport. For a taller
  element, `playwright-cli -s=shots resize 1280 1600` and run the script again.
- `playwright-cli -s=shots close` when done, and stop the `http.server`. A session left
  open keeps the browser running.
