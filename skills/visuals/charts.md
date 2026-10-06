# Charts

Shapes for numbers. Each example is a whole frame body: put it between the `<link>` and the
`<script>` from SKILL.md step 3. Columns, pies and lines are Vega-Lite, drawn by
`render.js`, and the rest are plain HTML on `frame.css`.

## Stat card

One number moving, or two or three that move together. Each `.stat` has a `<small>` label,
the old value in `<s>`, the new one in `<mark>` (or `<b>` when it is unchanged), and the
delta in `<em>` (`<em class="bad">` when it got worse).

- A card holds one value under a label of a few words. Parts of a total get a card each,
  or go in stacked columns or a pie. A breakdown goes in a chart, never in the label.
- Up to four cards in a row. A value of 7 characters (`104,472`) fits four, and longer
  ones fit three.
- Each number shows once. A card holds the total, and the chart under it holds the parts.
- The `<s>` and the delta come in when the question asks for a comparison or the change
  is a finding the answer mentions. The delta is a number (`−25%`, `3× as many`), with what it
  compares against after it.
- A finding with one number drops the `<s>`.

```html
<h1>Search is 7× faster after the index on <mark class="good">title</mark></h1>
<div class="panel">
<div class="stats">
  <div class="stat"><small>p95 search time</small><s>1.8 s</s><mark class="good">240 ms</mark><em>−87%</em></div>
  <div class="stat"><small>Searches over 1 s, per day</small><s>4,120</s><mark class="good">31</mark><em>−99%</em></div>
  <div class="stat"><small>Results for "acme"</small><b>24</b><em>unchanged</em></div>
</div>
</div>
```

## Bars

Numbers across cases. `--max` is the scale and each bar's `--v` its value, in one unit. A
`<mark>` on the bar the claim is about. The label goes inside the bar.

```html
<h1>Checkout in ap-south takes 4× as long as in us-east</h1>
<div class="panel">
<div class="bars" style="--max:2400">
  <i>us-east</i><span style="--v:610">610 ms</span>
  <i>eu-west</i><span style="--v:1120">1,120 ms</span>
  <i>sa-east</i><span style="--v:1340">1,340 ms</span>
  <i>ap-south</i><mark style="--v:2380">2,380 ms, 1,900 of it a cold start</mark>
</div>
</div>
```

## Bars, before and after

The same cases measured twice. Pair `.was` and `.now` bars under one label, with an empty
`<i></i>` before the second, and a `.key` of tags on top.

```html
<h1>Batching cut every import, most of all the large ones</h1>
<div class="panel">
<div class="key"><span class="tag before">Before</span><span class="tag after">After</span></div>
<div class="bars" style="--max:198">
  <i>500 rows</i><span class="was" style="--v:9">9 s</span>
  <i></i><span class="now" style="--v:4">4 s</span>
  <i>3,441 rows</i><span class="was" style="--v:62">62 s</span>
  <i></i><span class="now" style="--v:14">14 s</span>
  <i>20,000 rows</i><span class="was" style="--v:198">198 s</span>
  <i></i><mark class="good" style="--v:31">31 s, 6× faster</mark>
</div>

</div>
```

## Columns

Counts per day, week or release, where time runs left to right. Vega-Lite `bar`, drawn by
`render.js`, which fills bars in yellow with an ink stroke. Set `"sort": null` so the days
keep their order. Cut the days from the query's own window, so a window from 03:40 to 03:40
over 5 days gives 5 columns, each named by the day it starts, and the caption names the cut. A `condition` on `color` turns the bar the claim is about coral, and a
`text` layer puts each count on top. When the question asked for the total, a stat card
with it sits above. Each column carries one count: a second series gets columns of its own,
[grouped](#grouped-columns) or [stacked](#stacked-columns).

```html
<h1>The nightly import created 48,210 records in 5 days, almost none on Saturday</h1>
<div class="panel">
<div class="stats">
  <div class="stat"><small>Records created, Sep 30 to Oct 4</small><b>48,210</b></div>
  <div class="stat"><small>On Saturday, Oct 4</small><mark>180</mark><em class="bad">−99% vs the days before</em></div>
</div>
<script type="application/vega-lite+json">
{
  "height": 300,
  "data": {"values": [
    {"day":"Tue, Sep 30","n":12480},{"day":"Wed, Oct 1","n":11920},{"day":"Thu, Oct 2","n":12760},
    {"day":"Fri, Oct 3","n":10870},{"day":"Sat, Oct 4","n":180,"cause":true}
  ]},
  "encoding": {
    "x": {"field":"day","type":"ordinal","sort":null,"title":null,"axis":{"labelAngle":0,"labelFontSize":14,"labelColor":"#111","labelFontWeight":700}},
    "y": {"field":"n","type":"quantitative","title":"Records created","axis":{"format":",d"}}
  },
  "layer": [
    {"mark": {"type":"bar","width":{"band":0.6}},
     "encoding": {"color": {"condition":{"test":"datum.cause","value":"#ff8a6b"},"value":"#ffd84d"}}},
    {"mark": {"type":"text","dy":-10,"fontSize":15,"fontWeight":900}, "encoding": {"text":{"field":"n","format":",d"}}}
  ]
}
</script>
</div>
```

## Stacked columns

Counts over time that split into parts: by source, by type, by team. The columns spec with
a `color` field: blue for the part the claim names, yellow for the rest, and a legend
`render.js` draws on top as coloured squares. `y` and `text` sum `n`, so the bars stack and
the count on top is the day's total. Coral stays free for a cause. A part under about 5% of
its column is a sliver in the stack, so it goes in grouped columns, where its count sits on
its own bar.

```html
<h1>The nightly import created 48,210 records in 5 days, two thirds from the API</h1>
<div class="panel">
<div class="stats">
  <div class="stat"><small>Records created, Sep 30 to Oct 4</small><b>48,210</b></div>
  <div class="stat"><small>From the API</small><b>32,140</b></div>
  <div class="stat"><small>From CSV uploads</small><b>16,070</b></div>
</div>
<script type="application/vega-lite+json">
{
  "height": 300,
  "data": {"values": [
    {"day":"Tue, Sep 30","source":"API","n":8320},{"day":"Tue, Sep 30","source":"CSV upload","n":4160},
    {"day":"Wed, Oct 1","source":"API","n":7950},{"day":"Wed, Oct 1","source":"CSV upload","n":3970},
    {"day":"Thu, Oct 2","source":"API","n":8510},{"day":"Thu, Oct 2","source":"CSV upload","n":4250},
    {"day":"Fri, Oct 3","source":"API","n":7240},{"day":"Fri, Oct 3","source":"CSV upload","n":3630},
    {"day":"Sat, Oct 4","source":"API","n":120},{"day":"Sat, Oct 4","source":"CSV upload","n":60}
  ]},
  "encoding": {
    "x": {"field":"day","type":"ordinal","sort":null,"title":null,"axis":{"labelAngle":0,"labelFontSize":14,"labelColor":"#111","labelFontWeight":700}},
    "y": {"aggregate":"sum","field":"n","type":"quantitative","title":"Records created","axis":{"format":",d"}}
  },
  "layer": [
    {"mark": {"type":"bar","width":{"band":0.6}},
     "encoding": {"color": {"field":"source","type":"nominal","sort":null,"title":null,"scale":{"range":["#5b5bf7","#ffd84d"]}}}},
    {"mark": {"type":"text","dy":-10,"fontSize":15,"fontWeight":900}, "encoding": {"text":{"aggregate":"sum","field":"n","format":",d"}}}
  ]
}
</script>
</div>
```

## Grouped columns

Two or three series per day, week or release, side by side, when the claim compares the
series rather than their sum, or names a part too small to stack ("only 412 in the mobile
app"). The columns spec with `xOffset` on the series field: blue for the series the claim
names, yellow for the rest, a legend `render.js` draws on top as coloured squares, and each
count on its own bar.

```html
<h1>Chat overtook email in week 39 and doubled it by week 40</h1>
<div class="panel">
<script type="application/vega-lite+json">
{
  "height": 300,
  "data": {"values": [
    {"week":"Week 36","channel":"Email","n":820},{"week":"Week 36","channel":"Chat","n":410},
    {"week":"Week 37","channel":"Email","n":790},{"week":"Week 37","channel":"Chat","n":560},
    {"week":"Week 38","channel":"Email","n":760},{"week":"Week 38","channel":"Chat","n":720},
    {"week":"Week 39","channel":"Email","n":640},{"week":"Week 39","channel":"Chat","n":980},
    {"week":"Week 40","channel":"Email","n":580},{"week":"Week 40","channel":"Chat","n":1170}
  ]},
  "encoding": {
    "x": {"field":"week","type":"ordinal","sort":null,"title":null,"axis":{"labelAngle":0,"labelFontSize":14,"labelColor":"#111","labelFontWeight":700}},
    "xOffset": {"field":"channel","type":"nominal","sort":null},
    "y": {"field":"n","type":"quantitative","title":"Tickets","axis":{"format":",d"}}
  },
  "layer": [
    {"mark": {"type":"bar","width":{"band":0.85}},
     "encoding": {"color": {"field":"channel","type":"nominal","sort":null,"title":null,"scale":{"range":["#ffd84d","#5b5bf7"]}}}},
    {"mark": {"type":"text","dy":-10,"fontSize":13,"fontWeight":900}, "encoding": {"text":{"field":"n","format":",d"}}}
  ]
}
</script>
</div>
```

Horizontal bars side by side are [Bars, before and after](#bars-before-and-after).

## Pie

Shares of one whole, when the claim is a share ("62% of tickets"). Vega-Lite `arc` as a
donut with the total in the middle, drawn by `render.js`, which fills arcs yellow with an
ink stroke.

- Five slices or fewer. Fold the smallest into "Other".
- Largest first from 12 o'clock, clockwise: `order` sorts `n` descending.
- Each slice labelled directly with its name and percent, which a `transform` computes
  from the counts. The slice the claim is about is coral.
- Optional: the count on a second line, when the reader needs the counts as well as the
  shares. The example has it: `label` is a two-item array, and each item is a line. For
  one line, make `label` the first item alone.
- Optional: a caption, as in SKILL.md step 3. The example has one.
- Each label starts 14px outside the ring at its slice's middle angle, `mid`. A label on
  the right half starts there, one on the left ends there, and one near the top or bottom
  sits above or below it, so every label keeps the same gap to the ring.
- Shares across days or teams go in stacked columns, and shares of different wholes in
  bars.

```html
<h1>Billing questions are 62% of the 2,000 support tickets in September</h1>
<div class="panel">
<script type="application/vega-lite+json">
{
  "height": 270,
  "layer": [
    {"data": {"values": [
       {"topic":"Billing","n":1240,"claim":true},{"topic":"Login","n":310},{"topic":"Bug reports","n":260},{"topic":"Other","n":190}
     ]},
     "transform": [
       {"joinaggregate":[{"op":"sum","field":"n","as":"total"}]},
       {"window":[{"op":"sum","field":"n","as":"upto"}],"sort":[{"field":"n","order":"descending"}]},
       {"calculate":"2 * PI * (datum.upto - datum.n / 2) / datum.total","as":"mid"},
       {"calculate":"[datum.topic + ' ' + format(datum.n / datum.total, '.0%'), format(datum.n, ',')]","as":"label"}
     ],
     "encoding": {
       "theta": {"field":"n","type":"quantitative","stack":true},
       "order": {"field":"n","sort":"descending"}
     },
     "layer": [
       {"mark": {"type":"arc","innerRadius":80,"outerRadius":130},
        "encoding": {"color": {"condition":{"test":"datum.claim","value":"#ff8a6b"},"value":"#ffd84d"}}},
       {"mark": {"type":"text","radius":144,"fontSize":15,"fontWeight":900,
                 "align":{"expr":"sin(datum.mid) >= 0 ? 'left' : 'right'"},
                 "baseline":{"expr":"cos(datum.mid) > 0.7 ? 'bottom' : cos(datum.mid) < -0.7 ? 'top' : 'middle'"}},
        "encoding": {"text":{"field":"label"}}}
     ]},
    {"data": {"values":[{"total":"2,000","unit":"tickets"}]},
     "layer": [
       {"mark": {"type":"text","x":{"expr":"width / 2"},"y":{"expr":"height / 2"},"dy":-8,"fontSize":34,"fontWeight":900}, "encoding": {"text":{"field":"total"}}},
       {"mark": {"type":"text","x":{"expr":"width / 2"},"y":{"expr":"height / 2"},"dy":20,"fontSize":14,"color":"#6b6b6b"}, "encoding": {"text":{"field":"unit"}}}
     ]}
  ]
}
</script>
<p>Tickets opened Sep 1 to Sep 30, spam left out. Billing: 820 refunds and 420 invoice questions.</p>
</div>
```

## Line + marker

A metric over time around an event: a deploy, an incident, a config change. Vega-Lite, drawn
by `render.js`, which supplies the theme, a container width and a 260px height. A `rule`
layer marks the event and a `rect` band shades the time after it. Times are full ISO
timestamps on a plain `temporal` field.

```html
<h1>Checkout errors tripled after the 14:02 deploy</h1>
<div class="panel">
<script type="application/vega-lite+json">
{
  "data": {"values": [
    {"t":"2026-01-05T13:30","rate":0.8},{"t":"2026-01-05T13:40","rate":0.9},{"t":"2026-01-05T13:50","rate":0.7},{"t":"2026-01-05T14:00","rate":0.8},
    {"t":"2026-01-05T14:10","rate":2.6},{"t":"2026-01-05T14:20","rate":2.4},{"t":"2026-01-05T14:30","rate":2.7},{"t":"2026-01-05T14:40","rate":2.5}
  ]},
  "encoding": {"x": {"field":"t","type":"temporal","title":null,"axis":{"format":"%H:%M"}}},
  "layer": [
    {"data": {"values":[{"from":"2026-01-05T14:02","to":"2026-01-05T14:40"}]},
     "mark": {"type":"rect","color":"#ffe1d8"},
     "encoding": {"x":{"field":"from","type":"temporal"},"x2":{"field":"to"}}},
    {"data": {"values":[{"t":"2026-01-05T14:02","label":"14:02 deploy v4.12"}]},
     "layer": [
       {"mark": "rule"},
       {"mark": {"type":"text","align":"left","baseline":"bottom","dx":8,"y":{"expr":"height - 8"},"color":"#9a3a22","fontSize":14,"fontWeight":900}, "encoding": {"text":{"field":"label"}}}
     ]},
    {"mark": "line", "encoding": {"y": {"field":"rate","type":"quantitative","title":"Errors, % of checkouts"}}},
    {"mark": "point", "encoding": {"y": {"field":"rate","type":"quantitative"}}}
  ]
}
</script>
</div>
```

## Matrix

Where it fails across two dimensions: browser by login method, version by region. A table
with `td.ok` and `td.no` cells. The `<mark>` goes in the failing cell and carries the
reason.

```html
<h1>Login fails only on Safari with SSO</h1>
<div class="panel">
<table>
  <thead><tr><th>Browser</th><th>Password</th><th>Magic link</th><th>SSO</th></tr></thead>
  <tr><td>Chrome</td><td class="ok">✓</td><td class="ok">✓</td><td class="ok">✓</td></tr>
  <tr><td>Firefox</td><td class="ok">✓</td><td class="ok">✓</td><td class="ok">✓</td></tr>
  <tr><td>Safari</td><td class="ok">✓</td><td class="ok">✓</td><td class="no"><mark>✗ cookie blocked</mark></td></tr>
  <tr><td>Edge</td><td class="ok">✓</td><td class="ok">✓</td><td class="ok">✓</td></tr>
</table>
</div>
```

## Funnel

Where items drop out of a pipeline. `--max` is what went in and each stage's `--v` what is
left. A `.drop` line between stages names each loss, and `.drop.cause` the one the claim is
about.

```html
<h1>3,200 of 10,000 rows are lost to duplicate keys</h1>
<div class="panel">
<div class="funnel" style="--max:10000">
  <span style="--v:10000">10,000 rows uploaded</span>
  <span class="drop">−800 unparseable dates</span>
  <span style="--v:9200">9,200 parsed</span>
  <span class="drop cause">−3,200 duplicate order_id, silently skipped</span>
  <mark style="--v:6000">6,000 saved</mark>
</div>
</div>
```

## Record diff

Which fields differ between two records, one that works and one that does not. `table.diff`,
a column per record named by its id, `tr.same` for the fields that match. A `<mark>` on the
value that differs.

```html
<h1>The order that fails to sync has no currency</h1>
<div class="panel">
<table class="diff">
  <thead><tr><th>Field</th><th>ABC-123, syncs</th><th>ABC-124, fails</th></tr></thead>
  <tr class="same"><td>status</td><td>"paid"</td><td>"paid"</td></tr>
  <tr class="same"><td>total</td><td>40.00</td><td>40.00</td></tr>
  <tr><td>currency</td><td>"USD"</td><td><mark>null</mark></td></tr>
  <tr class="same"><td>customer_id</td><td>8812</td><td>8813</td></tr>
</table>
</div>
```

## Vega-Lite gotchas

- Times need a full ISO timestamp (`"2026-01-05T14:02"`). A bare `"14:02"` parses as
  nothing, and every point lands on the y axis.
- Leave `timeUnit` off ISO times. It bins them all to midnight.
- Set `color` only on the layer that is the cause, such as the event label. The theme
  draws lines and points in ink and fills bars and arcs yellow.
- A `color` field gets its legend from the theme: coloured squares in a row on top. Set
  `"title": null` on the field and leave the `legend` out.
- A layer's `encoding` reaches every layer nested in it, and a layer whose data lacks the
  field draws nothing. A layer with its own data, such as the pie's total, sits beside the
  encoded layer, not inside it.
- A spec error reaches `gh-attach shot`, which fails with the message. Fix the spec and
  render again.
