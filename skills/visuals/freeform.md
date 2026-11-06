# Freeform

A **freeform** shape is one you compose for this claim when no recipe in the table fits it,
or when a recipe would say it flatter than a custom layout. Mock the UI region that
changed, put a big number beside the flow that caused it, set three cards in a row with
arrows, or draw an inline `<svg>`. The checks in SKILL.md step 4 still decide whether it
passes.

## Palette

Every colour is a token in `frame.css`. Use the tokens, never a new hex value.

| Token                            | Meaning                                     |
| -------------------------------- | ------------------------------------------- |
| `--pink`, `mark`                 | the cause, a failure, the before state      |
| `--blue`, `.after`               | the after state, information                |
| `--green`, `mark.good`           | a win, a pass                               |
| `--yellow`                       | the thing to look at, a neutral fill        |
| `--lilac`, `--orange`            | extra series or groups with no verdict      |
| `--<colour>-tint`                | a quiet background for the same meaning     |
| `--ink`, `--paper`, `--soft`     | lines and text, white ground, a grey well   |
| `--sans`, `--mono`               | Space Grotesk for text, Space Mono for labels |

Text on every fill stays `--ink`. Keep one meaning per colour in the image.

## Parts

| Class                                      | What it draws                                         |
| ------------------------------------------ | ----------------------------------------------------- |
| `.kicker`                                  | a black mono label above the `h1`                     |
| `.row`, `.grid2`, `.grid3`, `.grid4`       | a wrapping row, or equal columns                      |
| `.box`                                     | a card with an ink border and a hard shadow           |
| `.box > b:first-child`                     | the card's mono label                                 |
| `.c-<colour>`, `.t-<colour>`               | a bright fill, or its tint, on any element            |
| `.stat.c-<colour>`                         | a stat card in a bright fill                          |
| `.big`                                     | a huge number inside a `.box`                         |
| `.chip`                                    | a small mono tag                                      |
| `.sticker`                                 | a tilted yellow label that calls one thing out        |
| `.arrow`                                   | a mono arrow between parts (`→`, `↓`, `⇄`)            |
| `.callout`, `.callout.bad`, `.callout.good` | a band with a thick left edge                        |

The recipe classes (`.node`, `.lane`, `.cols`, `.bars`, `.stats`, `table`, `.pin`) mix
with these freely.

## Example

```html
<span class="kicker">Fix · checkout</span>
<h1>Retries now stop after 3 tries, so a bad card <mark class="good">fails in 4 s</mark></h1>
<div class="panel">
<div class="row">
  <div class="box t-pink"><b>Before</b><span class="big">96 s</span>retries until timeout</div>
  <span class="arrow">→</span>
  <div class="box c-yellow"><b>Change</b>max 3 tries, 1 s apart</div>
  <span class="arrow">→</span>
  <div class="box c-green"><b>After</b><span class="big">4 s</span>card error shown</div>
</div>
<div class="callout good">The user sees the card error at once and can try another card.</div>
</div>
```

## Inline SVG

Draw a shape that HTML can't hold, such as a custom map, a gauge or an annotated curve, as
an inline `<svg>` with a `viewBox` and `width="100%"`. Use the tokens through
`style="fill: var(--pink); stroke: var(--ink)"`, an ink stroke of 2.5 to 3, and
`font-weight` 700 for labels. Keep every label inside the `viewBox`: `render.js` checks the
`<svg>` box, not the text inside it.
