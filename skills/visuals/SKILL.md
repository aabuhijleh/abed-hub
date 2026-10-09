---
name: visuals
description: >-
  Draw the image that proves a claim at a glance: a screenshot ringed on the point, a
  diagram, or a chart. Use when a PR change needs a before/after, a finding needs its
  cause shown, a system or flow needs explaining, or a result is in numbers.
license: MIT
allowed-tools: Bash(playwright-cli:*), Bash(gh-attach shot:*), Bash(printf:*), Bash(cat:*), Bash(cp:*), Bash(sed:*), Bash(mkdir:*), Bash(python3 -m http.server:*), Bash(magick identify:*)
---

# Visuals

This skill makes images, one per **claim**, and hands back each PNG's path with its claim
as alt text. Whatever the image goes with (a PR, an answer, a Slack or Jira post, a doc)
writes the prose and posts it.

The **claim** is one sentence the image proves, with a subject, what happened, and the
number or cause: "Imports fail at 60 s because the proxy drops idle requests". Every step
below serves it: you write the claim, draw it, then check the image against it.

## 1. Write the brief

Make a folder for the job (`mkdir -p /tmp/visuals/<slug>`) and open `frame.html` in it
with the brief as a comment:

```html
<!--
Claim:  Checkout errors tripled after the 14:02 deploy
Branch: finding
Data:   error rate per 10 min, 13:30 to 14:40, from the dashboard in the ticket; deploy time from the release log
Shape:  line + marker
-->
```

- **Branch** is what the image is for: **change** (a before and an after), **finding**
  (what happened and why), **explainer** (how something works), or **result** (numbers).
- **Data** is every name and number the image will show, each with its source: the
  ticket, the thread, a query you ran, the code on each branch. Use the real case: the
  actual record, the 60 s timeout, "19 results, now 24".
- **Shape** comes from step 2.

Done when every field is filled and every value in Data names its source.

## 2. Pick the shape

| The claim is about…                        | Shape                       | In                               |
| ------------------------------------------ | --------------------------- | -------------------------------- |
| how the UI looks or changed                | screenshot, ringed if busy  | [screenshots.md](screenshots.md) |
| an image the user sent                     | pin                         | [screenshots.md](screenshots.md) |
| a state or step sequence                   | flow                        | [diagrams.md](diagrams.md)       |
| a decision, a loop, a branch               | branching flow              | [diagrams.md](diagrams.md)       |
| messages between parts, a failing hop      | sequence                    | [diagrams.md](diagrams.md)       |
| which part of a system, nested or fan-out  | box diagram                 | [diagrams.md](diagrams.md)       |
| a path through a hierarchy                 | tree                        | [diagrams.md](diagrams.md)       |
| what runs when, a deadline                 | timeline                    | [diagrams.md](diagrams.md)       |
| where an item lands in an order            | order strip                 | [diagrams.md](diagrams.md)       |
| a rule that treats cases differently       | table                       | [diagrams.md](diagrams.md)       |
| one number moving                          | stat card                   | [charts.md](charts.md)           |
| numbers across categories                  | bars                        | [charts.md](charts.md)           |
| counts per day, week or release            | columns                     | [charts.md](charts.md)           |
| counts over time that split into parts     | stacked columns             | [charts.md](charts.md)           |
| series over time compared, or a tiny part  | grouped columns             | [charts.md](charts.md)           |
| shares of one whole                        | pie                         | [charts.md](charts.md)           |
| a metric over time around an event         | line + marker               | [charts.md](charts.md)           |
| where it fails across two dimensions       | matrix                      | [charts.md](charts.md)           |
| where items drop out of a pipeline         | funnel                      | [charts.md](charts.md)           |
| which fields differ between two records    | record diff                 | [charts.md](charts.md)           |

Read the file for your shape and copy its example. Draw each claim in one shape: a flow
and a table of the same change say it twice.

A change to docs, copy or config goes in as a ```` ```diff ```` block, and command output
or a test run as text. Those, a dependency bump and a rename get no image.

## 3. Build and render

The frame links this skill's files from its base directory, `<skill-dir>`, and holds the
shape inside a `.panel`:

```html
<link rel="stylesheet" href="<skill-dir>/frame.css">
<h1>Checkout errors tripled after the 14:02 deploy</h1>
<div class="panel">
  <!-- the shape -->
</div>
<script src="<skill-dir>/render.js"></script>
```

```bash
gh-attach shot /tmp/visuals/<slug>/frame.html /tmp/visuals/<slug>/<slug>.png
```

The layout follows the branch:

- **finding, result, explainer:** the claim is the `h1`. A bare `<mark>` is the cause, in
  coral. `<mark class="good">` is a win, in blue.
- **change:** one `<div class="side before">` and one `<div class="side after">`, each
  opening with `<span class="tag">Before</span>` or `After`. Stacked by default.
  `class="panel pair"` puts them side by side, which suits two narrow screenshots. The
  `h1` names the case ("Importing a 3,441-row CSV") or the claim. Before shows the failure
  the way the user met it, after the same case working, each built from its own branch.

What goes on the image:

- **The headline is the claim** in about 12 plain words a stranger repeats after one
  read: the reader's words from the UI, the ticket or the thread, and a concrete number or
  cause.
- **One mark per image,** on the claim's subject. Chart bars and columns are filled
  yellow, and everything else stays ink on white.
- **Anchors:** what the claim is about, plus one unchanged neighbour on each side so the
  reader sees where it sits.
- **The product's own icon for each UI state it names,** in the headline, labels and
  table cells: the tick, badge or glyph the reader sees on screen, copied as
  [screenshots.md](screenshots.md#the-products-icons) says.
- **Labels of a few words.** A side gets one `.note` line only when the picture can't say
  it.
- **An optional caption, when the claim needs qualifying.** A `<p>` last in the panel,
  under any shape, is the caption: the period, what is left out, the source, a breakdown too fine
  to draw ("Billing: 820 refunds and 420 invoice questions"). Up to two lines, and none
  when the headline and shape say it all. A number the claim rests on goes in the shape,
  and the caption adds what the shape can't hold. The chart's legend names its colours.
- **Words through deslop, once.** Before the first render, invoke the `deslop` skill and
  run it over the headline, labels and caption in one pass. One call per
  session covers every image. Re-renders keep the words unless a step 4 check fails on them.

`render.js` draws Mermaid diagrams and Vega-Lite charts in the frame's style, then checks
the fit. `gh-attach shot` waits for it, and fails when anything runs off the panel or out
of its stat card, naming the element and by how much. Fix the frame (shorter labels, fewer
cards or bars, another shape) and render again.

## 4. Look and improve

Read every PNG with the Read tool, then re-read the brief. The image passes when all of
these hold:

- **Proves the claim:** a reader who has only the image can state the claim. Every number
  on it matches Data. The mark sits on the claim's subject, and nothing else pulls the eye.
- **Makes sense:** the shape suits the claim (numbers as bars or a stat, not a table of
  them). Every label is readable and whole, nothing overlaps or runs off the panel, rows
  and sides line up, and a stranger to the codebase knows every term. Each stat card holds
  one value under a one-line label. Every UI state it names shows the product's icon, or
  an emoji when the product has none.
- **The headline reads clearly:** one read, no function names, the number or cause in it.
  Its period matches the chart's: "in 5 days" over 5 columns, a partial day dropped or
  named.

When a check fails, fix it at the level it lives at and render again: the words, then the
data shown, then the shape, then the claim itself when it was too vague to draw. When the
same shape fails twice, switch shape. Repeat until every check passes.

When no shape can prove the claim, hand back no image and say in a sentence what it would
have shown.

## 5. Hand back

Return each PNG's path with its claim as the alt text. Order them so the **lead image**
comes first: the one whose claim answers the question as asked. When the question asks for
a number, the lead image's headline and a stat card carry that number, and the finding
about it (the day it dropped) goes under the card in the same panel. More cards sit beside
it when the answer rests on them, such as the parts of the total. Draw the other findings
the answer mentions too. One about that number, such as a drop against the days before
shown as a delta, goes under its card. One about something else, such as a source that
stopped, gets its own image after the lead. Add a summary image (a stat card, or a box
diagram with every cause marked) only when no single finding answers it.

For a PR, call the Skill tool with `gh-attach` and put each image under `## Evidence`.

## Gotchas

- **Charts and diagrams need `gh-attach` 0.3.0 or later.** Older `shot` captures before
  Mermaid and Vega-Lite finish, and the PNG comes back with an empty panel.
- **Every image you hand back is a frame rendered by `gh-attach shot`, whether it goes to
  a PR, Slack, Jira or a doc.** `shot` only renders: it writes the frame's `h1` into the
  PNG's `Title`, and an agent runner may refuse an image without one. A screenshot goes
  into the frame as its `<img>` first. Needs `gh-attach` 0.4.0 or later.
- **Link `frame.css` where it sits.** A copy elsewhere loses `archivo.woff2` and falls back
  to the system font.
- **`render.js` stays a classic `<script src>`.** Chrome blocks module scripts on a `file:`
  page.
- **A label covers nothing the claim needs.** When a ring's label hides a neighbour that
  proves "only" or "unchanged", move the label (`.right`, `.up`) or shorten it.
- **A headline says only what the image shows.** "3 days left to pay" over a status list
  is a claim the reader can't check.
- `note: the package's browser is missing, using …` from `gh-attach shot` is harmless.

## Requirements

`playwright-cli`, a chromium build and `gh-attach`, all installed by the abed-hub
`gh-attach` component. Charts and diagrams load Mermaid and Vega-Lite from jsDelivr, so
they need the network. When a tool is missing or `gh-attach` is older than 0.4.0, call the
Skill tool with `abed-hub` and repair the `gh-attach` component.
