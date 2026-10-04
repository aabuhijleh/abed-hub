---
name: screenshots
description: >-
  Make images that explain something at a glance: screenshots with the point ringed and
  labelled, and illustrations drawn as a flow, timeline, table or order strip. Use for any
  image that goes with text, in a PR, an answer, a Slack message, a Jira ticket, a doc or a
  report: a before/after of a change, what happened in a bug or an incident, how a system
  or its data flow works, or a result worth seeing.
license: MIT
allowed-tools: Bash(playwright-cli:*), Bash(gh-attach shot:*), Bash(printf:*), Bash(cat:*), Bash(cp:*), Bash(sed:*)
---

# Screenshots

This skill makes the image only, wherever it goes: a PR, an answer, a Slack or Jira post, a
doc. The prose comes from whatever it goes with, such as `/pr` or the repo's template.

The **point** is what the image is for: a change, the cause of a bug, how something works,
a result. Every step below centres on it.

## When to shoot

- **On screen:** a screenshot of the page, steps 1 to 3.
- **Behind the UI:** an illustration, when prose or a diff makes the point hard to follow:
  logic, a path through the work, where data flows, what runs when.
  [Step 2b](#2b-illustrate-what-the-ui-doesnt-show), then step 3.
- **A change:** a before and an after, for either of the above.
- **Anything else:** what happened in a bug, how a system works, a finding, a result. One
  image per point, as one `<div class="side before">` with no `.tag`, so the `<mark>` on
  the cause gets the failure colour.
- **Text:** a change to docs, a README, copy or config goes in as a ```diff block. An image
  of text is larger and harder to read than the diff.

Leave the image out when a reader gets the point at a glance, as with a dependency bump or
a rename. Command output and test runs stay as text. An image the user handed you goes out
as it is only when it already shows the point. Otherwise ring the part the text is about.

## What the image says

- **The real case.** Use the record, input and numbers from the PR, the ticket, the thread
  or the question: the actual names, the 60 s timeout, "19 results, now 24".
- **Before shows the failure** the way the user met it: the error they saw, the wrong value,
  the row that went missing. After shows the same case working.
- **One change, one shape.** Draw each change once. A flow and a table of the same change
  say it twice.
- **One image per question.** A PR, answer or thread can carry several images, and each answers one
  question: one per UI change, one for the backend and one for the frontend, one for the
  fix and one for the checks that nothing else broke.
- **Anchors, not context.** Keep what changed and one unchanged neighbour on each side, so
  the reader sees where it sits. Cut the rest.
- **Few words.** A title only when the diagram needs one, naming the case ("Importing a
  3,441-row CSV"). No caption paragraph. A side gets at most one short `.note` line, and
  only when the picture can't say it.
- **The reader's words.** Domain terms from the repo's glossary, not function names.

## 1. Open the page at 2x

The default session is 1x, which blurs once the frame scales the crop. Open a named session
with a 2x config, in the app's default theme (`playwright-cli -s=shots set-color-scheme
light` when it follows the system):

```bash
printf '{ "browser": { "contextOptions": { "deviceScaleFactor": 2, "viewport": { "width": 1280, "height": 900 } } } }\n' > /tmp/shots.config.json
playwright-cli -s=shots open --config=/tmp/shots.config.json <url>
playwright-cli -s=shots --raw eval "() => location.href"
```

The `eval` must print the URL you opened. Then drive the app to the changed state; call the
Skill tool with `playwright-cli` for the commands. For a before/after pair, shoot the same
selector, viewport and theme twice: the base state first (the default branch, or what is
deployed), then the branch.

## 2. Crop, and spotlight when the crop is busy

Crop to the smallest element that changed: the cell, not the table. When that crop holds
only the change, shoot it plain. The Before and After tags carry the comparison:

```bash
playwright-cli -s=shots screenshot "<selector>" --hires --filename=/abs/path/after.png
```

When the change sits in a larger view the reader needs, such as a busy screen where it is
one row among many, spotlight it with [`highlight.js`](highlight.js) from this skill's
folder. It rings the element, darkens the rest, and hangs a label naming the change ("Stays
active at 13/13") under the ring's bottom-right corner. Set `BEFORE` to `true` for the
before shot:

```bash
sed -e 's/LABEL/Stays active at 13\/13/' -e 's/BEFORE/false/' -e 's/EMPTY//' <skill-dir>/highlight.js > /tmp/highlight.js
playwright-cli -s=shots eval "$(cat /tmp/highlight.js)" "<selector>"
playwright-cli -s=shots screenshot "#shot-region" --hires --filename=/abs/path/after.png
```

When the fix is that something no longer appears on the page, the after shot rings an
empty slot where it was. Set `EMPTY` to a few words for it ("Not created") and point
`<selector>` at the element now in its place.

`<selector>` is a snapshot ref (`e12`) or a selector that matches one element
(`table tr:nth-child(3) td.status`). The region is the element plus 16px. Raise `pad` in
the script for more context. Run it again after any navigation or re-render, since the
marks go with the old DOM.

## 2b. Illustrate what the UI doesn't show

Skip steps 1 and 2. Build each side as HTML inside step 3's panel, using the
classes in [`frame.css`](frame.css). Pick the shape that shows the problem:

- **Flow or states:** one `.lane` per side, steps as `.node`, edges as `.to` with an
  optional label. Unchanged steps line up across the lanes, and a step the fix removes is
  left out of the after lane.
- **Table:** one table, cases down the side, a `before` and an `after` column, and a `tfoot`
  total when a count proves the fix. Suits a rule that treats cases differently.
- **Timeline:** `.time` rails on a shared clock, for a change in what runs when or at once.
  A `.cut` marks a deadline such as a timeout.
- **Order:** a `.cols` strip, for where a column, record or step lands. A `.gap` marks one
  that is missing.

`<mark>` goes on what changed. A flow, with the state change on its edge label:

```html
<div class="side before"><span class="tag">Before</span>
  <div class="lane"><span class="node">Placed</span><span class="to">card declined</span><mark class="node">Cancelled</mark></div></div>
<div class="side after"><span class="tag">After</span>
  <div class="lane"><span class="node">Placed</span><span class="to">card declined</span><mark class="node">Awaiting payment</mark><span class="to">paid within 3 days</span><span class="node">Paid</span></div></div>
```

A table:

```html
<table>
  <thead><tr><th>Invoice</th><th class="before">Before</th><th class="after">After</th></tr></thead>
  <tr><td>Annual, first year</td><td>$408</td><td>$408</td></tr>
  <tr><td>Annual, renewal</td><td class="before"><mark>$480</mark></td><td class="after"><mark>$408</mark></td></tr>
</table>
```

A timeline, with `--span` and every `--at` and `--to` in seconds:

```html
<div class="side before"><span class="tag">Before</span>
  <div class="time" style="--span:210">
    <i>Browser</i><div class="rail"><span style="--at:0;--to:60">One request, waiting</span><span class="fail" style="--at:62">Network error</span></div>
    <i>Server</i><div class="rail"><span style="--at:0;--to:198">Import finishes, nobody listening</span></div>
    <div class="cut" style="--at:60"><b>Proxy drops idle requests at 60 s</b></div>
  </div></div>
<div class="time" style="--span:210"><span></span><div class="axis"><span style="--at:0">0</span><span style="--at:60">1 min</span><span style="--at:120">2 min</span><span style="--at:180">3 min</span></div></div>
```

On the after side, `.wait` draws polling or a queue, `.win` the moment it works, and `.end`
right-aligns a bar to its `--at`. An order strip:

```html
<div class="cols"><span>Cart</span><mark>Payment<small>before shipping</small></mark><span>Shipping</span><span class="gap">no review</span></div>
```

Build each side from the code on that side: the base branch for Before, your branch for
After.

## 3. Frame

Copy [`frame.css`](frame.css) from this skill's folder next to the PNGs, write the frame
beside it, and render it:

```html
<!doctype html>
<meta charset="utf-8">
<link rel="stylesheet" href="frame.css">
<h1>Optional: the case, in the reader's words</h1>
<div class="panel pair">
  <div class="side before"><span class="tag">Before</span><img class="shot" src="before.png" alt="Before"></div>
  <div class="side after"><span class="tag">After</span><img class="shot" src="after.png" alt="After"></div>
</div>
```

```bash
cp <skill-dir>/frame.css /abs/path/
gh-attach shot /abs/path/frame.html /abs/path/evidence.png --width 948
```

- `pair` puts the sides next to each other. Drop it to stack them, which suits a crop wider
  than it is tall and every illustration.
- An illustration puts step 2b's markup in the `.panel` in place of the `img` sides.
- `--width 948` for GitHub, `--width 1200` for Slack.

## 4. Look before posting

Read every PNG you made, the crops and the framed image, with the Read tool. Post it only
when all of these hold:

- It shows the page you meant, not a blank or `about:blank` frame.
- A reader who knows only the question or the bug report gets the point from the image
  alone.
- `<mark>` or the ring sits on the point, and nothing else draws the eye.
- The ring's label hides no neighbour the reader needs. When it does, shorten the label.
- Every word is readable at the posted width, and the sides line up where they match.

Anything else, fix the selector, state, content or frame and shoot again.

## playwright-cli traps

- It blocks `file:` URLs, so a local HTML page goes through `gh-attach shot`, which reads
  files and URLs.
- A screenshot of a page that never loaded saves `about:blank` and exits 0. The URL check
  in step 1 catches it.
- The marks are `position: fixed`, so the region has to fit in the viewport. For a taller
  element, `playwright-cli -s=shots resize 1280 1600` and run the script again.
- `playwright-cli -s=shots close` when done. A session left open keeps the browser running.

## Hand off

GitHub: call the Skill tool with `gh-attach` and put each framed PNG in the PR description
under `## Evidence`, or in the issue or comment it explains. Anywhere else, such as Slack,
Jira, a doc or an answer's attachments: hand the PNGs to whatever posts or saves it.

## Requirements

`playwright-cli`, a chromium build and `gh-attach`, all installed by the abed-hub
`gh-attach` component. When one is missing, call the Skill tool with `abed-hub` and repair
the `gh-attach` component.
