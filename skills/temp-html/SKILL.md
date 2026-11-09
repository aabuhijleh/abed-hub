---
name: temp-html
description: >-
  Build a temp HTML report in a neobrutalist style, with a reading-progress rail and
  click-to-zoom images. Use when the user asks for a temp HTML, a temp document, or a
  report to read in the browser.
license: MIT
allowed-tools: Bash(cp:*), Bash(grep:*), Bash(git check-ignore:*), Bash(python3 -I -m http.server:*), Bash(playwright-cli:*), Bash(open:*), Bash(xdg-open:*)
---

# temp-html

A **report** is one self-contained HTML file built from [`template.html`](template.html). The template is the single source of truth for the look: neobrutalist theme on a white page, a reading rail with a progress meter and a contents list, a lightbox for images, and styled scrollbars. Reuse its classes. Add CSS only for a component it lacks, in the same style: 3px ink borders, hard offset shadows, flat accent fills, uppercase mono labels.

## 1. Pick the destination

- **Artifact requested**: write the file in the session scratchpad directory and publish it with the Artifact tool. Write no copy anywhere else.
- **Path named**: write it there.
- **In the repo**: use a git-ignored scratch folder (`.scratch/`, `scratch/`, `tmp/`, or similar). Confirm with `git check-ignore -q <dir>`. If no ignored folder exists, ask before you create one or edit `.gitignore`.
- **Otherwise**: write `<os-temp>/<slug>.html`, where `<os-temp>` is `python3 -c 'import tempfile; print(tempfile.gettempdir())'`.

Done when one absolute path is chosen.

## 2. Write the report

Copy the template to the path, then replace every placeholder.

### Voice

The reader scans; they do not read. Make the page **visual-first** and the text **terse**.

- **Show it.** Carry each point with a visual: a `.tbl` comparison, a `.flow` of steps, `.stat` numbers, a `.chip` status, an inline SVG diagram, or a screenshot from the `visuals` skill. The text labels the visual.
- **Bullets over paragraphs.** A paragraph holds at most 3 sentences. A list item holds one fact.
- **ASD-STE100 Simplified Technical English.** Active voice, one idea per sentence, at most 20 words per sentence, one word for one meaning. Define each term once, then reuse it unchanged.
- **Lead with the answer.** Each section opens with its conclusion, then the evidence.

### Structure

- **Sections**: each top-level topic is `<section id="...">` with `<h2><span class="n">N</span>Title</h2>`. The rail builds its contents from these. An `h3` with an `id` becomes a sub-entry. Put `data-title` on a heading to give the rail a shorter label.
- **Hero**: a kicker, an `h1` with one `<mark>`, and a lede that states the answer, not only the question.
- **Images**: every `img` inside `main` opens in the lightbox, with no extra markup. Put each in a `figure`; the first line of its `figcaption` becomes the lightbox caption. Embed images as base64 data URIs so the file stands alone. Show a raw screenshot through the `visuals` skill first when a point needs ringing.
- **Tables**: wrap each one in `<div class="tbl">` so wide tables scroll inside their card, not the page.
- **Colour meaning**: pink is risk or a bad result, green is a good result, yellow is the thing to look at, blue is information. Keep one meaning per colour across the report.
- **Self-contained**: inline all CSS and JS. The page works offline.

Done when every section holds at least one visual, no sentence passes 20 words, and no template text remains: `grep -nE 'REPORT TITLE|KIND · TICKET|Headline question|label</div>|screenshot.png|Sources and date' <path>` prints nothing.

## 3. Verify with playwright-cli

Load the `playwright-cli` skill. The browser blocks `file:` URLs, so serve the file's folder: `python3 -I -m http.server <port> --bind 127.0.0.1` in the background, then `playwright-cli open http://127.0.0.1:<port>/<file>`.

Run the pass at desktop (`resize 1440 900`) and at mobile (`resize 390 844`):

1. Eval this check. Pass means `overflow`, `offscreen`, and `broken` are 0, and `rail` equals `sections`.
   ```js
   (() => ({
     overflow: document.documentElement.scrollWidth - innerWidth,
     offscreen: [...document.querySelectorAll('main *')].filter(e => e.getBoundingClientRect().right > innerWidth + 1 && !e.closest('.tbl, pre')).length,
     broken: [...document.querySelectorAll('main img')].filter(i => !i.naturalWidth).length,
     sections: document.querySelectorAll('main section[id]').length,
     rail: document.querySelectorAll('.contents > ol > li').length,
   }))()
   ```
2. Screenshot the top, then scroll a mid section into view and screenshot again. The rail names that section and the percent moves.
3. Click a content image. Screenshot the open lightbox. Click the image to zoom to 1:1. Press `Escape` and confirm the page scrolls again.
4. At mobile, open the contents list and screenshot it.
5. Read every screenshot. Look for clipped text, overlapping cards, and weak contrast.

Fix what fails and rerun the pass. Done when both widths pass every check. Then stop the server and close the browser.

## 4. Hand over

- **Local**: open the file with `open <path>` (macOS) or `xdg-open <path>` (Linux). Give the absolute path.
- **Artifact**: give the link.
